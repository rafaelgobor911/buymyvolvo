import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { emptyUsage } from "@/lib/extraction/cost";
import { type ExtractInput, ExtractionError, type ExtractResult } from "@/lib/extraction/extract";
import { processPendingRawPosts, reprocessEditedCaptions } from "@/lib/extraction/pipeline";
import type { Extraction } from "@/lib/extraction/schema";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-11-08T12:00:00-03:00");

const base: Extraction = {
  is_vehicle_for_sale: true,
  confidence: 0.95,
  model: "XC60",
  engine: "T8",
  trim: "Inscription",
  version_text: "T8 Inscription",
  year_fab: 2019,
  year_model: 2020,
  km: 41000,
  km_text: "41.000 km",
  price: 239900,
  price_text: "R$ 239.900",
  city: "Curitiba",
  uf: "PR",
  color: "preto",
  transmission: "automatico",
  fuel: "hibrido_plugin",
  options: [],
  seller_type: "particular",
  phones: ["(41) 90000-0101"],
  summary_ptbr: "SUV híbrido plug-in com baixa quilometragem e manutenção em dia.",
  red_flags: [],
};

/** Extraction answers keyed by a tag at the start of each test caption. */
const ANSWERS: Record<string, Extraction | "error"> = {
  "[a]": base,
  "[b]": { ...base, km: 41500, km_text: "41.500 km" },
  "[c]": {
    ...base,
    engine: "B5",
    trim: null,
    version_text: "B5",
    year_fab: 2022,
    year_model: 2022,
    fuel: null,
    phones: ["(41) 90000-0102"],
  },
  "[d]": "error",
  "[e]": { ...base, phones: ["(41) 90000-0199"] },
  "[f]": {
    ...base,
    model: "XC40",
    engine: "T5",
    trim: "R-Design",
    year_fab: 2019,
    year_model: 2019,
    km: 52000,
    km_text: "52.000 km",
    price: 145000,
    price_text: "R$ 145.000",
    fuel: "gasolina",
    phones: ["(41) 90000-0103"],
  },
  // The seller edited the caption of [a]: new price and km.
  "[r]": { ...base, price: 229900, price_text: "R$ 229.900", km: 42000, km_text: "42.000 km" },
};

const extract = vi.fn(async (input: ExtractInput): Promise<ExtractResult> => {
  const answer = ANSWERS[input.caption.slice(0, 3)];
  if (!answer) throw new Error(`no stub answer for ${input.caption}`);
  if (answer === "error") throw new ExtractionError("invalid_output", "stub failure", emptyUsage());
  return {
    output: answer,
    model: "claude-haiku-5-5",
    usage: { inputTokens: 200, outputTokens: 120, cacheWriteTokens: 0, cacheReadTokens: 3000 },
    attempts: 1,
  };
});

describe.skipIf(!url)("extraction pipeline (database)", () => {
  let sql: postgres.Sql;
  let sourceId: string;
  let removedListingId: string;

  const addPost = async (mediaId: string, caption: string, username: string | null = null) => {
    const [row] = await sql<{ id: string }[]>`
      insert into raw_posts (ig_media_id, source_id, permalink, caption, ig_username, posted_at, media_type)
      values (${mediaId}, ${sourceId}, ${`https://www.instagram.com/p/${mediaId}/`}, ${caption}, ${username}, ${NOW}, 'IMAGE')
      returning id`;
    return row!.id;
  };
  const statusOf = async (mediaId: string) =>
    (
      await sql<
        { processing_status: string }[]
      >`select processing_status from raw_posts where ig_media_id = ${mediaId}`
    )[0]?.processing_status;
  const listingOf = async (mediaId: string) =>
    (
      await sql<{ id: string; status: string; confidence: string; dedupe_key: string | null }[]>`
        select l.id, l.status, l.confidence::text, l.dedupe_key from listings l
        join listing_sources ls on ls.listing_id = l.id
        join raw_posts rp on rp.id = ls.raw_post_id
        where rp.ig_media_id = ${mediaId}`
    )[0];

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, onnotice: () => {} });
    [{ id: sourceId }] = await sql<{ id: string }[]>`
      insert into sources (type, handle) values ('ig_business_account', 'pipeline_test') returning id`;
    await sql`insert into blocklist (kind, value, reason) values
      ('ig_media_id', 'test-blocked-media', 'test'), ('phone', '+5541900000199', 'test')`;
    // A listing the seller removed: a repost of the same car must not bring it back.
    [{ id: removedListingId }] = await sql<{ id: string }[]>`
      insert into listings (slug, status, origin, model_id, engine_id, year_model, km, price_cents,
        contact_phone_e164, dedupe_key, removed_at)
      values ('volvo-xc40-t5-2019-removed-test', 'removed', 'instagram', 'xc40', 't5', 2019, 52000,
        14500000, '+5541900000103', null, now())
      returning id`;
  });

  afterAll(async () => {
    const listingIds = (
      await sql<{ listing_id: string }[]>`
        select ls.listing_id from listing_sources ls
        join raw_posts rp on rp.id = ls.raw_post_id where rp.source_id = ${sourceId}`
    ).map((r) => r.listing_id);
    await sql`delete from listing_sources where raw_post_id in (select id from raw_posts where source_id = ${sourceId})`;
    await sql`delete from listings where id = any(${[...listingIds, removedListingId]})`;
    await sql`delete from raw_posts where source_id = ${sourceId}`;
    await sql`delete from sources where id = ${sourceId}`;
    await sql`delete from blocklist where reason = 'test'`;
    await sql.end();
  });

  it("publishes, moderates, merges, blocks and records each post once", async () => {
    await addPost(
      "test-a",
      "[a] Vendo XC60 T8 Inscription 19/20, 41.000 km, R$ 239.900. (41) 90000-0101",
    );
    await addPost(
      "test-b",
      "[b] Vendo XC60 T8 Inscription 19/20, 41.500 km, R$ 239.900, aceito troca. (41) 90000-0101",
    );
    await addPost("test-c", "[c] Vendo XC60 B5 2022 importado, R$ 245.000. (41) 90000-0102");
    await addPost("test-d", "[d] Vendo Volvo XC90 T8 2021 R$ 300.000 (41) 90000-0104");
    await addPost("test-e", "[e] Vendo XC60 T8 2020 R$ 239.900 (41) 90000-0199");
    await addPost(
      "test-f",
      "[f] Vendo XC40 T5 R-Design 2019, 52.000 km, R$ 145.000 (41) 90000-0103",
    );
    await addPost("test-g", "Encontro de Volvos no domingo! #volvoclub");
    await addPost(
      "test-blocked-media",
      "[a] Vendo XC60 T8 Inscription 19/20 R$ 239.900 (41) 90000-0101",
    );

    const stats = await processPendingRawPosts(sql, { extract, now: () => NOW }, { limit: 100 });

    expect(stats.processed).toBe(8);
    expect(stats.outcomes).toMatchObject({
      published: 1,
      merged: 1,
      moderation: 1,
      error: 1,
      blocklisted: 2,
      prefiltered_out: 1,
      skipped_removed: 1,
    });
    // Neither the pre-filtered post nor the blocklisted media reach the model.
    expect(extract).toHaveBeenCalledTimes(6);
    expect(stats.costUsd).toBeGreaterThan(0);

    const a = await listingOf("test-a");
    expect(a?.status).toBe("active");
    expect(a?.dedupe_key).toMatch(/^[0-9a-f]{32}$/);
    expect((await listingOf("test-b"))?.id).toBe(a?.id);

    const c = await listingOf("test-c");
    expect(c?.status).toBe("pending_review");
    expect(Number(c?.confidence)).toBeLessThan(0.85);

    expect(await statusOf("test-d")).toBe("error");
    expect(await listingOf("test-e")).toBeUndefined();
    expect(await listingOf("test-f")).toBeUndefined();
    expect(await statusOf("test-g")).toBe("not_listing");

    const [{ status: removedStatus }] = await sql<{ status: string }[]>`
      select status from listings where id = ${removedListingId}`;
    expect(removedStatus).toBe("removed");

    const [tokens] = await sql<
      { tokens_in: number; tokens_out: number; extraction_model: string }[]
    >`
      select tokens_in, tokens_out, extraction_model from raw_posts where ig_media_id = 'test-a'`;
    expect(tokens).toEqual({
      tokens_in: 3200,
      tokens_out: 120,
      extraction_model: "claude-haiku-5-5",
    });
  });

  it("is idempotent: a second run finds nothing to do", async () => {
    extract.mockClear();
    const stats = await processPendingRawPosts(sql, { extract, now: () => NOW });
    expect(stats.processed).toBe(0);
    expect(extract).not.toHaveBeenCalled();
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from listing_sources ls
      join raw_posts rp on rp.id = ls.raw_post_id where rp.source_id = ${sourceId}`;
    expect(count).toBe(3);
  });

  it("a repost of a rejected listing goes back to moderation", async () => {
    const a = (await listingOf("test-a"))!;
    await sql`update listings set status = 'rejected', rejected_at = now() where id = ${a.id}`;
    await addPost(
      "test-h",
      "[b] Vendo XC60 T8 Inscription 19/20, 41.500 km, R$ 239.900, aceito troca. (41) 90000-0101",
    );
    const stats = await processPendingRawPosts(sql, { extract, now: () => NOW });
    expect(stats.outcomes.merged).toBe(1);
    expect((await listingOf("test-a"))?.status).toBe("pending_review");
    const [entry] = await sql<{ actor: string; action: string; changes: unknown }[]>`
      select actor, action, changes from audit_log
      where entity = 'listing' and entity_id = ${a.id} order by at desc limit 1`;
    expect(entry).toEqual({
      actor: "system:process-posts",
      action: "listing.reopen",
      changes: { status: { from: "rejected", to: "pending_review" } },
    });
  });

  it("an edited caption is re-extracted once: price and km follow it, with the old values kept", async () => {
    const a = (await listingOf("test-a"))!;
    await sql`
      update raw_posts set
        caption = '[r] Vendo XC60 T8 Inscription 19/20, 42.000 km, agora R$ 229.900. (41) 90000-0101',
        caption_changed_at = ${NOW}
      where ig_media_id = 'test-a'`;
    const stats = await reprocessEditedCaptions(sql, { extract, now: () => NOW });
    expect(stats).toMatchObject({ checked: 1, updated: 1, errors: 0 });
    const [row] = await sql<{ price_cents: string; km: number }[]>`
      select price_cents, km from listings where id = ${a.id}`;
    expect(row).toEqual({ price_cents: "22990000", km: 42000 });
    const [entry] = await sql<{ action: string; changes: unknown; note: string }[]>`
      select action, changes, note from audit_log
      where entity = 'listing' and entity_id = ${a.id} order by at desc, id desc limit 1`;
    expect(entry).toEqual({
      action: "listing.caption_update",
      changes: {
        priceCents: { from: 23990000, to: 22990000 },
        km: { from: 41000, to: 42000 },
      },
      note: "Legenda editada no Instagram",
    });
    // The same edit is not processed twice.
    expect((await reprocessEditedCaptions(sql, { extract, now: () => NOW })).checked).toBe(0);
  });
});
