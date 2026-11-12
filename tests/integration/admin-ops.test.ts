import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addBlock,
  confirmRemoval,
  listRemovalRequests,
  normalizeBlockValue,
  rejectRemoval,
  removeBlock,
} from "@/lib/admin/blocklist";
import { leadsByDay, leadsByListing, leadsBySeller, leadsCsv } from "@/lib/admin/leads-report";
import { setListingStatus } from "@/lib/admin/listings";
import { addSources, hashtagBudget, listSources, setSourceActive } from "@/lib/admin/sources";
import { recordView } from "@/lib/listings/views";

const url = process.env.TEST_DATABASE_URL;
const ACTOR = "admin:admin.teste@example.com";

describe.skipIf(!url)("admin operations (database)", () => {
  let sql: postgres.Sql;
  let sourceId: string;
  const listings: string[] = [];
  const requests: string[] = [];

  const listing = async (
    suffix: string,
    fields: { status?: string; phone?: string; ig?: string },
  ) => {
    const [{ id }] = await sql<{ id: string }[]>`
      insert into listings (slug, status, origin, model_id, engine_id, year_model, price_cents,
        contact_phone_e164, contact_ig_username, removed_at, authorized_at)
      values (${`volvo-v60-t5-2017-teste-${suffix}`}, ${fields.status ?? "active"}, 'instagram',
        'v60', 't5', 2017, 11500000, ${fields.phone ?? null}, ${fields.ig ?? null},
        ${fields.status === "removed" ? new Date() : null},
        ${fields.status === "pending_review" ? null : new Date()})
      returning id`;
    listings.push(id);
    return id;
  };

  beforeAll(async () => {
    sql = postgres(url!, { max: 2, onnotice: () => {} });
    [{ id: sourceId }] = await sql<{ id: string }[]>`
      insert into sources (type, handle, active) values ('ig_business_account', 'ops_test_demo', false)
      returning id`;
  });

  afterAll(async () => {
    await sql`delete from blocklist where removal_request_id = any(${requests}) or reason like 'ops-test%'`;
    await sql`delete from removal_requests where id = any(${requests})`;
    await sql.begin(async (tx) => {
      await tx`set local buymyvolvo.allow_lead_delete = 'on'`;
      await tx`delete from leads where listing_id = any(${listings})`;
    });
    await sql`delete from listings where id = any(${listings})`;
    await sql`delete from raw_posts where source_id = ${sourceId}`;
    await sql`delete from sources where id = ${sourceId} or handle in ('loja_ops.demo', 'tag_ops_demo')`;
    await sql`delete from hashtag_budget where ig_user_id = 'ops-test'`;
    await sql.end();
  });

  it("confirming a removal keeps the listing down and blocks its phone, @ and posts", async () => {
    const id = await listing("ops001", {
      status: "removed",
      phone: "+5541900000401",
      ig: "Loja.Removida",
    });
    const [{ id: postId }] = await sql<{ id: string }[]>`
      insert into raw_posts (ig_media_id, source_id, permalink, ig_username)
      values ('ops-media-1', ${sourceId}, 'https://www.instagram.com/p/OpsTest/', 'loja.removida')
      returning id`;
    await sql`insert into listing_sources (listing_id, raw_post_id, is_primary) values (${id}, ${postId}, true)`;
    const [{ id: requestId }] = await sql<{ id: string }[]>`
      insert into removal_requests (listing_id, requester_contact, reason)
      values (${id}, 'dono@example.com', 'Vendi') returning id`;
    requests.push(requestId);

    expect((await listRemovalRequests(sql)).find((r) => r.id === requestId)).toMatchObject({
      status: "pending",
      listingStatus: "removed",
      hoursOpen: 0,
    });
    expect(await confirmRemoval(sql, { id: requestId, actor: ACTOR })).toEqual({
      ok: true,
      blocked: 3,
    });
    const blocked = await sql<{ kind: string; value: string }[]>`
      select kind, value from blocklist where removal_request_id = ${requestId} order by kind`;
    expect(blocked).toEqual([
      { kind: "ig_media_id", value: "ops-media-1" },
      { kind: "ig_username", value: "loja.removida" },
      { kind: "phone", value: "+5541900000401" },
    ]);
    expect(await confirmRemoval(sql, { id: requestId, actor: ACTOR })).toEqual({
      ok: false,
      error: "Este pedido já foi processado.",
    });
  });

  it("refusing a removal needs a reason and puts the listing back up", async () => {
    const id = await listing("ops002", { status: "active", phone: "+5541900000402" });
    const [{ id: requestId }] = await sql<{ id: string }[]>`
      insert into removal_requests (listing_id, reason) values (${id}, 'Não sou eu') returning id`;
    requests.push(requestId);
    await sql`update listings set status = 'removed', removed_at = now() where id = ${id}`;

    expect(await rejectRemoval(sql, { id: requestId, actor: ACTOR, note: " " })).toMatchObject({
      ok: false,
    });
    expect(await rejectRemoval(sql, { id: requestId, actor: ACTOR, note: "Não é o dono" })).toEqual(
      {
        ok: true,
        blocked: 0,
      },
    );
    const [row] = await sql<{ status: string }[]>`select status from listings where id = ${id}`;
    expect(row?.status).toBe("active");
  });

  it("an admin removal can block the listing's contact too", async () => {
    const id = await listing("ops003", { phone: "+5541900000403" });
    await setListingStatus(sql, {
      id,
      status: "removed",
      actor: ACTOR,
      note: "ops-test golpe",
      block: true,
    });
    const [entry] = await sql<{ reason: string }[]>`
      select reason from blocklist where kind = 'phone' and value = '+5541900000403'`;
    expect(entry?.reason).toBe("ops-test golpe");
  });

  it("adds and removes blocklist entries with validation", async () => {
    expect(normalizeBlockValue("phone", "(41) 99876-5432")).toBe("+5541998765432");
    expect(normalizeBlockValue("phone", "+5520910000061")).toBe("+5520910000061");
    expect(normalizeBlockValue("phone", "123")).toBeNull();
    expect(normalizeBlockValue("ig_username", "@Perfil.Ops")).toBe("perfil.ops");

    expect(await addBlock(sql, { kind: "phone", value: "123", reason: "", actor: ACTOR })).toEqual({
      ok: false,
      error: "Telefone inválido.",
    });
    const added = await addBlock(sql, {
      kind: "ig_username",
      value: "@Perfil.Ops",
      reason: "ops-test manual",
      actor: ACTOR,
    });
    expect(added).toEqual({ ok: true, added: true });
    expect(
      await addBlock(sql, {
        kind: "ig_username",
        value: "perfil.ops",
        reason: "ops-test",
        actor: ACTOR,
      }),
    ).toEqual({ ok: true, added: false });
    const [{ id }] = await sql<{ id: string }[]>`
      select id from blocklist where kind = 'ig_username' and value = 'perfil.ops'`;
    expect(await removeBlock(sql, { id, actor: ACTOR })).toBe(true);
    const [audit] = await sql<{ action: string }[]>`
      select action from audit_log where entity = 'blocklist' and entity_id = ${id} order by at desc, id desc limit 1`;
    expect(audit?.action).toBe("blocklist.remove");
  });

  it("adds, pauses and resumes sources; reports the hashtag budget", async () => {
    const result = await addSources(sql, {
      type: "ig_business_account",
      text: "@loja_ops.demo, inválido!, loja_ops.demo",
      actor: ACTOR,
    });
    expect(result).toEqual({
      added: ["loja_ops.demo"],
      existing: ["loja_ops.demo"],
      invalid: ["inválido!"],
    });
    const tags = await addSources(sql, { type: "ig_hashtag", text: "#tag_ops_demo", actor: ACTOR });
    expect(tags.added).toEqual(["tag_ops_demo"]);
    const source = (await listSources(sql)).find((s) => s.handle === "tag_ops_demo")!;
    expect(source).toMatchObject({ type: "ig_hashtag", pollIntervalMinutes: 1440, active: true });
    expect(await setSourceActive(sql, { id: source.id, active: false, actor: ACTOR })).toBe(true);
    expect(await setSourceActive(sql, { id: source.id, active: false, actor: ACTOR })).toBe(false);

    const before = await hashtagBudget(sql);
    await sql`
      insert into hashtag_budget (ig_user_id, hashtag, ig_hashtag_id, window_started_at, last_queried_at)
      values ('ops-test', 'volvo_ops', '1', now() - interval '2 days', now())`;
    const after = await hashtagBudget(sql);
    expect(after.used).toBe(before.used + 1);
    const entry = after.entries.find((e) => e.hashtag === "volvo_ops")!;
    expect(entry.freesAt.getTime() - entry.windowStartedAt.getTime()).toBe(7 * 86_400_000);
  });

  it("reports leads and views by day, listing and seller, and exports CSV", async () => {
    const id = await listing("ops004", { phone: "+5541900000404" });
    await recordView(sql, id);
    await recordView(sql, id);
    await recordView(sql, id);
    await recordView(sql, id);
    await sql`
      insert into leads (listing_id, ref_code, channel, click_count, utm_source)
      values (${id}, 'VX-OPS01', 'whatsapp', 2, 'insta;gram')`;

    const [today] = await leadsByDay(sql, 7);
    expect(today!.views).toBeGreaterThanOrEqual(4);
    expect(today!.leads).toBeGreaterThanOrEqual(1);
    const row = (await leadsByListing(sql, 7)).find((r) => r.id === id);
    expect(row).toMatchObject({ views: 4, leads: 1, clicks: 2, rate: 0.25 });
    expect(
      (await leadsBySeller(sql, 7)).find((s) => s.sellerId === null)?.leads,
    ).toBeGreaterThanOrEqual(1);

    const csv = await leadsCsv(sql, 7);
    expect(csv.startsWith("﻿data_hora;codigo;canal;cliques;")).toBe(true);
    const line = csv.split("\r\n").find((l) => l.includes("VX-OPS01"))!;
    expect(line).toContain(";whatsapp;2;");
    expect(line).toContain(';"insta;gram";');
    expect(csv).not.toMatch(/ip_hash|ua_hash/);
  });
});
