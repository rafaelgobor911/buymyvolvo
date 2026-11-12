import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { leadPreview, publicSlugFor, recordClick, type ClickInput } from "@/lib/leads/record";
import { saltedHash } from "@/lib/leads/request";

const url = process.env.TEST_DATABASE_URL;
const BMV_1 = "+5511900000001";
const BMV_2 = "+5511900000002";
const SALT = "integration-test-salt-not-a-secret-000";
const SITE = { name: "Volvo Teste", url: "https://site.test" };

const device = (n: number) => ({
  ipHash: saltedHash(SALT, `200.0.0.${n}`),
  uaHash: saltedHash(SALT, `Mozilla/5.0 test device ${n}`),
});

const click = (shortId: string, n = 1, extra: Partial<ClickInput> = {}): ClickInput => ({
  shortId,
  ...device(n),
  origin: {
    referrer: `/anuncio/x-${shortId}`,
    utmSource: "instagram",
    utmMedium: null,
    utmCampaign: null,
  },
  site: SITE,
  ...extra,
});

describe.skipIf(!url)("leads (database)", () => {
  let sql: postgres.Sql;
  let sourceId: string;
  const ids: string[] = [];

  const lead = async (ref: string) =>
    (
      await sql<
        {
          click_count: number;
          ip_hash: string | null;
          referrer: string | null;
          utm_source: string | null;
          channel: string;
          routed_to: string | null;
        }[]
      >`
        select click_count, ip_hash, referrer, utm_source, channel, routed_to from leads
        where ref_code = ${ref}`
    )[0];

  let savedNumbers: unknown;
  const setNumbers = (value: string) =>
    sql`update app_settings set value = ${sql.json(value)} where key = 'bmv_whatsapp_numbers'`;

  beforeAll(async () => {
    sql = postgres(url!, { max: 6, onnotice: () => {} });
    [{ value: savedNumbers }] = await sql<{ value: unknown }[]>`
      select value from app_settings where key = 'bmv_whatsapp_numbers'`;
    await setNumbers(BMV_1);
    [{ id: sourceId }] = await sql<{ id: string }[]>`
      insert into sources (type, handle) values ('ig_hashtag', 'leads_test') returning id`;
    const listing = async (
      suffix: string,
      fields: { status?: string; phone?: string | null; ig?: string | null },
    ) => {
      const status = fields.status ?? "active";
      const [{ id }] = await sql<{ id: string }[]>`
        insert into listings (slug, status, origin, model_id, engine_id, trim_id, year_fab, year_model,
          km, price_cents, contact_phone_e164, contact_ig_username, sold_at, removed_at,
          authorized_at)
        values (${`volvo-xc60-t8-inscription-2020-teste-${suffix}`}, ${status}, 'instagram', 'xc60',
          't8', 'inscription', 2019, 2020, 41000, 23990000, ${fields.phone ?? null}, ${fields.ig ?? null},
          ${status === "sold" ? new Date() : null}, ${status === "removed" ? new Date() : null},
          ${status === "pending_review" ? null : new Date()})
        returning id`;
      ids.push(id);
      return id;
    };
    await listing("lt0001", { phone: "+5511987654321" });
    await listing("lt0002", { phone: "+5520910000999" });
    await listing("lt0003", { ig: "loja.teste" });
    const hashtagOnly = await listing("lt0004", {});
    await listing("lt0005", { status: "sold", phone: "+5511987654322" });
    await listing("lt0006", { status: "removed", phone: "+5511987654323" });
    await listing("lt0007", {});
    await listing("lt0008", { phone: "+5511987654324" });
    await listing("lt0009", { status: "pending_review", phone: "+5511987654325" });
    const [{ id: postId }] = await sql<{ id: string }[]>`
      insert into raw_posts (ig_media_id, source_id, permalink, ig_username)
      values ('leads-test-media', ${sourceId}, 'https://www.instagram.com/p/LeadsTest1/', null)
      returning id`;
    await sql`insert into listing_sources (listing_id, raw_post_id, is_primary) values (${hashtagOnly}, ${postId}, true)`;
  });

  afterAll(async () => {
    await sql.begin(async (tx) => {
      await tx`set local buymyvolvo.allow_lead_delete = 'on'`;
      await tx`delete from leads where listing_id = any(${ids})`;
    });
    await sql`update app_settings set value = '24' where key = 'lead_dedupe_hours'`;
    await sql`update app_settings set value = ${sql.json(savedNumbers as string)}
              where key = 'bmv_whatsapp_numbers'`;
    await sql`delete from listings where id = any(${ids})`;
    await sql`delete from raw_posts where source_id = ${sourceId}`;
    await sql`delete from sources where id = ${sourceId}`;
    await sql.end();
  });

  it("a click records a lead and opens Buy My Volvo's WhatsApp with the message", async () => {
    const result = await recordClick(sql, click("lt0001"));
    expect(result.kind).toBe("contact");
    if (result.kind !== "contact") return;
    expect(result).toMatchObject({
      channel: "whatsapp",
      routedTo: BMV_1,
      repeated: false,
      fictitious: false,
    });
    expect(result.refCode).toMatch(/^VX-[2-9A-Z]{5}$/);
    expect(result.message).toBe(
      `Olá! Tenho interesse no Volvo XC60 T8 Inscription 2020 anunciado no Volvo Teste (https://site.test/a/lt0001). Ainda está disponível? (ref. ${result.refCode})`,
    );
    // Intermediated: the seller's phone (+5511987654321) is never the destination.
    expect(result.url).toBe(
      `https://wa.me/5511900000001?text=${encodeURIComponent(result.message)}`,
    );
    expect(await lead(result.refCode)).toEqual({
      click_count: 1,
      ip_hash: device(1).ipHash,
      referrer: "/anuncio/x-lt0001",
      utm_source: "instagram",
      channel: "whatsapp",
      routed_to: BMV_1,
    });
  });

  it("the same device within the window reuses the lead; another device gets a new one", async () => {
    const first = await recordClick(sql, click("lt0008", 1));
    const again = await recordClick(sql, click("lt0008", 1));
    const other = await recordClick(sql, click("lt0008", 2));
    if (first.kind !== "contact" || again.kind !== "contact" || other.kind !== "contact") {
      throw new Error("expected contacts");
    }
    expect(again).toMatchObject({ refCode: first.refCode, repeated: true });
    expect(other.refCode).not.toBe(first.refCode);
    expect((await lead(first.refCode)).click_count).toBe(2);

    // Outside the window (0 h) the same device makes a new lead.
    await sql`update app_settings set value = '0' where key = 'lead_dedupe_hours'`;
    const later = await recordClick(sql, click("lt0008", 1));
    await sql`update app_settings set value = '24' where key = 'lead_dedupe_hours'`;
    expect(later.kind === "contact" && later.refCode).not.toBe(first.refCode);
  });

  it("simultaneous clicks from one device make a single lead", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => recordClick(sql, click("lt0001", 7))),
    );
    const refs = new Set(results.map((r) => (r.kind === "contact" ? r.refCode : null)));
    expect(refs.size).toBe(1);
    expect((await lead([...refs][0]!)).click_count).toBe(5);
  });

  it("demo listings or a demo Buy My Volvo number (DDD 20) show the preview, only for them", async () => {
    const demo = await recordClick(sql, click("lt0002"));
    expect(demo).toMatchObject({ kind: "contact", channel: "whatsapp", fictitious: true });
    if (demo.kind !== "contact") return;
    const preview = await leadPreview(sql, demo.refCode, SITE);
    expect(preview).toMatchObject({
      refCode: demo.refCode,
      title: "XC60 T8 Inscription",
      clickCount: 1,
    });
    expect(preview?.message).toContain(`(ref. ${demo.refCode})`);

    const real = await recordClick(sql, click("lt0001", 3));
    expect(real.kind === "contact" && (await leadPreview(sql, real.refCode, SITE))).toBeNull();
    expect(await leadPreview(sql, "VX-ZZZZZ", SITE)).toBeNull();
    expect(await leadPreview(sql, "drop table", SITE)).toBeNull();

    await setNumbers("+5520900000000");
    const demoNumber = await recordClick(sql, click("lt0001", 4));
    expect(demoNumber).toMatchObject({ fictitious: true, routedTo: "+5520900000000" });
    await setNumbers(BMV_1);
  });

  it("with two numbers, new leads alternate and a repeated click keeps its number", async () => {
    await setNumbers(`${BMV_1}, ${BMV_2}`);
    try {
      // Listings without the seller's phone go to Buy My Volvo just the same.
      const results = [];
      for (const n of [20, 21, 22]) results.push(await recordClick(sql, click("lt0003", n)));
      const routed = results.map((r) => (r.kind === "contact" ? r.routedTo : null));
      expect(routed[0]).not.toBe(routed[1]);
      expect(routed[2]).toBe(routed[0]);
      expect(new Set(routed)).toEqual(new Set([BMV_1, BMV_2]));
      const again = await recordClick(sql, click("lt0003", 21));
      expect(again).toMatchObject({ repeated: true, routedTo: routed[1] });
      expect(await recordClick(sql, click("lt0004", 23))).toMatchObject({ kind: "contact" });
    } finally {
      await setNumbers(BMV_1);
    }
  });

  it("no lead when the listing is sold, never authorized, not public or without a number", async () => {
    const before = (await sql<{ n: number }[]>`select count(*)::int as n from leads`)[0]!.n;
    expect(await recordClick(sql, click("lt0005"))).toEqual({
      kind: "listing",
      slug: "volvo-xc60-t8-inscription-2020-teste-lt0005",
    });
    expect(await recordClick(sql, click("lt0006"))).toEqual({ kind: "not_found" });
    expect(await recordClick(sql, click("lt0009"))).toEqual({ kind: "not_found" });
    expect(await recordClick(sql, click("zz9999"))).toEqual({ kind: "not_found" });
    expect(await recordClick(sql, click("a b"))).toEqual({ kind: "not_found" });
    // Buy My Volvo's number not configured yet: back to the listing page.
    await setNumbers("");
    expect(await recordClick(sql, click("lt0007"))).toMatchObject({ kind: "listing" });
    await setNumbers(BMV_1);
    expect((await sql<{ n: number }[]>`select count(*)::int as n from leads`)[0]!.n).toBe(before);

    expect(await publicSlugFor(sql, "lt0005")).toBe("volvo-xc60-t8-inscription-2020-teste-lt0005");
    expect(await publicSlugFor(sql, "lt0006")).toBeNull();
    expect(await publicSlugFor(sql, "lt0009")).toBeNull();
  });

  it("leads are an audit trail: no deletes, only outcome and counters change; anon cannot read", async () => {
    const result = await recordClick(sql, click("lt0001", 9));
    if (result.kind !== "contact") throw new Error("expected contact");
    const ref = result.refCode;
    await expect(
      sql`update leads set ref_code = 'VX-AAAAA' where ref_code = ${ref}`,
    ).rejects.toThrow(/Only seller_id, outcome/);
    await expect(sql`update leads set ip_hash = null where ref_code = ${ref}`).rejects.toThrow();
    await expect(sql`delete from leads where ref_code = ${ref}`).rejects.toThrow(
      /cannot be deleted/,
    );
    await sql`update leads set outcome = 'not_sold', outcome_reported_at = now() where ref_code = ${ref}`;

    await expect(
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        return tx`select ref_code from leads limit 1`;
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
