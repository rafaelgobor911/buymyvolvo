import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setSourceLocation } from "@/lib/admin/sources";
import { UF_BY_DDD } from "@/lib/extraction/location";
import { processPendingRawPosts } from "@/lib/extraction/pipeline";
import type { Extraction } from "@/lib/extraction/schema";

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date("2026-11-10T12:00:00-03:00");

const extraction = (phone: string | null, extra: Partial<Extraction> = {}): Extraction => ({
  is_vehicle_for_sale: true,
  confidence: 0.95,
  model: "XC60",
  engine: "T8",
  trim: null,
  version_text: "T8",
  year_fab: 2021,
  year_model: 2022,
  km: 30000,
  km_text: "30.000 km",
  price: 280000,
  price_text: "R$ 280.000",
  city: null,
  uf: null,
  color: null,
  transmission: "automatico",
  fuel: "hibrido_plugin",
  options: [],
  seller_type: "loja",
  phones: phone ? [phone] : [],
  summary_ptbr: "SUV híbrido plug-in com baixa quilometragem.",
  red_flags: [],
  ...extra,
});

describe.skipIf(!url)("location fallbacks (database)", () => {
  let sql: postgres.Sql;
  let shopId: string;
  let tagId: string;

  const addPost = async (sourceId: string, mediaId: string, caption: string) => {
    await sql`
      insert into raw_posts (ig_media_id, source_id, permalink, caption, posted_at, media_type)
      values (${mediaId}, ${sourceId}, ${`https://www.instagram.com/p/${mediaId}/`}, ${caption},
        ${NOW}, 'IMAGE')`;
  };
  const listingOf = async (mediaId: string) =>
    (
      await sql<{ id: string; city: string | null; uf: string | null; uf_from_ddd: boolean }[]>`
        select l.id, l.city, l.uf, l.uf_from_ddd from listings l
        join listing_sources ls on ls.listing_id = l.id
        join raw_posts rp on rp.id = ls.raw_post_id
        where rp.ig_media_id = ${mediaId}`
    )[0];

  beforeAll(async () => {
    sql = postgres(url!, { max: 1, onnotice: () => {} });
    [{ id: shopId }] = await sql<{ id: string }[]>`
      insert into sources (type, handle) values ('ig_business_account', 'loc_test_shop') returning id`;
    [{ id: tagId }] = await sql<{ id: string }[]>`
      insert into sources (type, handle) values ('ig_hashtag', 'loctesttag') returning id`;
  });

  afterAll(async () => {
    const ids = (
      await sql<{ listing_id: string }[]>`
        select ls.listing_id from listing_sources ls join raw_posts rp on rp.id = ls.raw_post_id
        where rp.source_id = any(${[shopId, tagId]})`
    ).map((r) => r.listing_id);
    await sql`delete from listing_sources where listing_id = any(${ids})`;
    await sql`delete from listings where id = any(${ids})`;
    await sql`delete from raw_posts where source_id = any(${[shopId, tagId]})`;
    await sql`delete from sources where id = any(${[shopId, tagId]})`;
    await sql.end();
  });

  it("the SQL function mirrors UF_BY_DDD for every area code", async () => {
    for (const [ddd, uf] of Object.entries(UF_BY_DDD)) {
      const [row] = await sql<{ uf: string | null }[]>`
        select public.uf_from_phone(${`+55${ddd}999990000`}) as uf`;
      expect(row?.uf, `DDD ${ddd}`).toBe(uf);
    }
    const [none] = await sql<
      { uf: string | null }[]
    >`select public.uf_from_phone('+5520900000000') as uf`;
    expect(none?.uf).toBeNull();
  });

  it("new listings: the DDD's state when the post says nothing; the shop's place once set", async () => {
    const answers: Record<string, Extraction> = {
      "[1]": extraction("(75) 99894-4000"),
      "[2]": extraction("(11) 96463-1993", { model: "XC90", year_model: 2023, year_fab: 2023 }),
      "[3]": extraction("(41) 90000-0301", {
        model: "XC40",
        engine: "T5",
        city: "Curitiba",
        uf: "PR",
        year_model: 2020,
        year_fab: 2020,
        fuel: "gasolina",
      }),
    };
    const extract = async (input: { caption: string }) => ({
      output: answers[input.caption.slice(0, 3)]!,
      model: "claude-haiku-5-5",
      usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      attempts: 1,
    });
    await addPost(tagId, "loc-1", "[1] Vendo Volvo XC60 T8 2022 R$ 280.000 (75) 99894-4000");
    await addPost(shopId, "loc-2", "[2] Volvo XC90 T8 2023 R$ 280.000 (11) 96463-1993");
    await processPendingRawPosts(sql, { extract, now: () => NOW });
    expect(await listingOf("loc-1")).toMatchObject({ city: null, uf: "BA", uf_from_ddd: true });
    expect(await listingOf("loc-2")).toMatchObject({ city: null, uf: "SP", uf_from_ddd: true });

    // The admin sets the shop's location: its listing without a place gets it (audited).
    const result = await setSourceLocation(sql, {
      id: shopId,
      city: "Vinhedo",
      uf: "sp",
      actor: "admin:a@example.com",
    });
    expect(result).toEqual({ ok: true, filled: 1 });
    expect(await listingOf("loc-2")).toMatchObject({
      city: "Vinhedo",
      uf: "SP",
      uf_from_ddd: false,
    });
    expect((await listingOf("loc-1"))?.uf).toBe("BA"); // a hashtag post: not the shop's
    const [audit] = await sql<{ action: string; note: string }[]>`
      select action, note from audit_log where entity_id = ${(await listingOf("loc-2"))!.id}
      order by at desc limit 1`;
    expect(audit).toEqual({ action: "listing.location_fill", note: "Local padrão da loja" });

    // Next posts from the shop: its place unless the post says otherwise.
    await addPost(shopId, "loc-3", "[3] XC40 T5 2020 em Curitiba R$ 280.000 (41) 90000-0301");
    await processPendingRawPosts(sql, { extract, now: () => NOW });
    expect(await listingOf("loc-3")).toMatchObject({
      city: "Curitiba",
      uf: "PR",
      uf_from_ddd: false,
    });
  });

  it("validates the location and only applies to shop accounts", async () => {
    expect(
      await setSourceLocation(sql, { id: shopId, city: "X", uf: "ZZ", actor: "admin:a" }),
    ).toEqual({
      ok: false,
      error: "UF inválida.",
    });
    expect(
      await setSourceLocation(sql, { id: shopId, city: "Vinhedo", uf: "", actor: "admin:a" }),
    ).toEqual({
      ok: false,
      error: "Informe a UF junto com a cidade.",
    });
    expect(
      await setSourceLocation(sql, { id: tagId, city: "", uf: "SP", actor: "admin:a" }),
    ).toEqual({
      ok: false,
      error: "Conta não encontrada.",
    });
    // Clearing it is allowed.
    expect(
      await setSourceLocation(sql, { id: shopId, city: "", uf: "", actor: "admin:a" }),
    ).toEqual({
      ok: true,
      filled: 0,
    });
  });
});
