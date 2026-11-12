import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { saveListing, getAdminListing } from "@/lib/admin/listings";
import {
  acceptInvite,
  createInvite,
  declineInvite,
  getOutreach,
  invitePath,
  loadInvite,
  recordDecline,
} from "@/lib/authorization/data";
import { SELLER_TERMS_VERSION } from "@/content/seller-terms";

const url = process.env.TEST_DATABASE_URL;
const KEY = "integration-test-salt-not-a-secret-000";
const NOW = new Date("2026-11-16T15:00:00.000Z");
const ADMIN = { actor: "admin:admin.teste@example.com", adminEmail: "admin.teste@example.com" };
const SELLER_PHONE = "+5541900000801";

const form = (extra: Partial<Parameters<typeof acceptInvite>[1]["form"]> = {}) => ({
  name: "Loja Teste Autorização",
  type: "loja",
  phone: "(41) 90000-0801",
  email: "loja.autorizacao@example.com",
  terms: true,
  alsoIds: [] as string[],
  ...extra,
});

describe.skipIf(!url)("seller authorization (database)", () => {
  let sql: postgres.Sql;
  let savedCommission: unknown;
  const ids: Record<string, string> = {};
  const shortIds: Record<string, string> = {};

  const codeFor = async (key: string) => {
    const outreach = await getOutreach(sql, ids[key]!);
    return invitePath(KEY, {
      listingId: ids[key]!,
      shortId: shortIds[key]!,
      invitedAt: outreach.invitedAt!,
    }).replace("/autorizar/", "");
  };
  const setCommission = (reais: number) =>
    sql`update app_settings set value = ${sql.json(reais)} where key = 'seller_commission_brl'`;
  const anonSees = async (id: string) =>
    (
      await sql.begin(async (tx) => {
        await tx`set local role anon`;
        return tx`select id from public.listings where id = ${id}`;
      })
    ).length > 0;

  beforeAll(async () => {
    sql = postgres(url!, { max: 2, onnotice: () => {} });
    [{ value: savedCommission }] = await sql<{ value: unknown }[]>`
      select value from app_settings where key = 'seller_commission_brl'`;
    const listing = async (key: string, phone: string | null, status = "pending_review") => {
      const [row] = await sql<{ id: string; short_id: string }[]>`
        insert into listings (slug, status, origin, model_id, engine_id, year_fab, year_model, km,
          price_cents, city, uf, contact_phone_e164, seller_type, summary_ptbr)
        values (${`volvo-xc60-t8-2021-teste-${key}`}, ${status}, 'instagram', 'xc60', 't8', 2020,
          2021, 30000, 26000000, 'Curitiba', 'PR', ${phone}, 'loja',
          'SUV híbrido com revisões em dia.')
        returning id, short_id`;
      ids[key] = row!.id;
      shortIds[key] = row!.short_id;
    };
    await listing("az0001", SELLER_PHONE);
    await listing("az0002", SELLER_PHONE); // same seller, another car
    await listing("az0003", "+5541900000802"); // another seller
    await listing("az0004", "+5541900000803");
    await listing("az0005", "+5541900000804");
  });

  afterAll(async () => {
    const all = Object.values(ids);
    await sql`delete from listings where id = any(${all})`;
    await sql`delete from sellers where phone_e164 = any(${[SELLER_PHONE, "+5541900000802"]})`;
    await sql`update app_settings set value = ${sql.json(savedCommission as number)}
              where key = 'seller_commission_brl'`;
    await sql.end();
  });

  it("the database only publishes, and only shows, authorized listings", async () => {
    await expect(
      sql`update listings set status = 'active' where id = ${ids.az0004!}`,
    ).rejects.toThrow(/listings_active_requires_authorization/);
    // A sold listing that was never authorized stays out of the public pages too.
    await sql`update listings set status = 'sold', sold_at = now() where id = ${ids.az0005!}`;
    expect(await anonSees(ids.az0005!)).toBe(false);
    await sql`update listings set authorized_at = now() where id = ${ids.az0005!}`;
    expect(await anonSees(ids.az0005!)).toBe(true);
    // The outreach table is private.
    await expect(
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        return tx`select * from public.listing_outreach limit 1`;
      }),
    ).rejects.toThrow(/permission denied/);
  });

  it("an invite needs the commission, then gives a signed link", async () => {
    await setCommission(0);
    expect(
      await createInvite(sql, { listingId: ids.az0001!, actor: ADMIN.actor, now: NOW }),
    ).toEqual({
      ok: false,
      error: "Defina a comissão em Configurações antes de convidar o vendedor.",
    });
    await setCommission(1500);
    const result = await createInvite(sql, {
      listingId: ids.az0001!,
      actor: ADMIN.actor,
      now: NOW,
    });
    expect(result).toMatchObject({ ok: true, invitedAt: NOW });
    expect(await getOutreach(sql, ids.az0001!)).toMatchObject({
      status: "invited",
      invitedAt: NOW,
      invitedBy: ADMIN.actor,
    });

    const code = await codeFor("az0001");
    const view = await loadInvite(sql, KEY, code, NOW);
    expect(view.kind).toBe("open");
    if (view.kind !== "open") return;
    expect(view).toMatchObject({ commissionCents: 150_000, sellerType: "loja" });
    expect(view.listing).toMatchObject({ modelName: "XC60", engineName: "T8", yearModel: 2021 });
    // The seller's other listing in moderation (same phone) can be authorized too.
    expect(view.others.map((o) => o.id)).toEqual([ids.az0002]);

    expect((await loadInvite(sql, KEY, `${code.slice(0, -2)}xx`, NOW)).kind).toBe("invalid");
    expect((await loadInvite(sql, "another-key", code, NOW)).kind).toBe("invalid");
    const later = new Date(NOW.getTime() + 31 * 86_400_000);
    expect((await loadInvite(sql, KEY, code, later)).kind).toBe("expired");

    // Without a commission the page does not open (the seller must see the value).
    await setCommission(0);
    expect((await loadInvite(sql, KEY, code, NOW)).kind).toBe("unavailable");
    await setCommission(1500);
  });

  it("a renewed invite invalidates the previous link", async () => {
    const old = await codeFor("az0001");
    const renewed = new Date(NOW.getTime() + 1000);
    await createInvite(sql, { listingId: ids.az0001!, actor: ADMIN.actor, now: renewed });
    expect((await loadInvite(sql, KEY, old, renewed)).kind).toBe("invalid");
    expect((await loadInvite(sql, KEY, await codeFor("az0001"), renewed)).kind).toBe("open");
  });

  it("the seller authorizes: seller, terms, commission and listings recorded, then the admin publishes", async () => {
    const code = await codeFor("az0001");
    const invalid = await acceptInvite(sql, {
      key: KEY,
      code,
      now: NOW,
      form: form({ phone: "123", terms: false }),
    });
    expect(invalid).toMatchObject({ ok: false, errors: { phone: expect.any(String) } });

    const result = await acceptInvite(sql, {
      key: KEY,
      code,
      now: NOW,
      form: form({ alsoIds: [ids.az0002!, ids.az0003!] }), // az0003 is not the seller's
    });
    expect(result).toEqual({ ok: true, authorized: 2 });

    const [seller] = await sql<
      { id: string; display_name: string; verified_via: string; terms_version_accepted: string }[]
    >`
      select id, display_name, verified_via, terms_version_accepted from sellers
      where phone_e164 = ${SELLER_PHONE}`;
    expect(seller).toMatchObject({
      display_name: "Loja Teste Autorização",
      verified_via: "invite_link",
      terms_version_accepted: SELLER_TERMS_VERSION,
    });
    const terms = await sql<{ terms: string }[]>`
      select terms from terms_acceptances where seller_id = ${seller!.id} order by terms`;
    expect(terms.map((t) => t.terms)).toEqual(["photo_license", "seller_terms"]);

    for (const key of ["az0001", "az0002"]) {
      expect(await getOutreach(sql, ids[key]!)).toMatchObject({
        status: "authorized",
        commissionCents: 150_000,
        termsVersion: SELLER_TERMS_VERSION,
        seller: { id: seller!.id, phone: SELLER_PHONE },
      });
      const [row] = await sql<{ authorized_at: Date | null; seller_id: string | null }[]>`
        select authorized_at, seller_id from listings where id = ${ids[key]!}`;
      expect(row).toEqual({ authorized_at: NOW, seller_id: seller!.id });
    }
    expect((await getOutreach(sql, ids.az0003!)).status).toBe("to_contact");
    const [audit] = await sql<{ actor: string; action: string }[]>`
      select actor, action from audit_log where entity_id = ${ids.az0001!}
      order by at desc, id desc limit 1`;
    expect(audit).toEqual({ actor: "public:authorization", action: "listing.authorize" });

    // The link now only says it was authorized.
    expect((await loadInvite(sql, KEY, code, NOW)).kind).toBe("authorized");
    expect(await acceptInvite(sql, { key: KEY, code, now: NOW, form: form() })).toMatchObject({
      ok: false,
      errors: { form: "Este anúncio já foi autorizado." },
    });
    expect(
      await createInvite(sql, { listingId: ids.az0001!, actor: ADMIN.actor, now: NOW }),
    ).toEqual({ ok: false, error: "O vendedor já autorizou este anúncio." });

    // The admin approves (no edits): public now.
    const current = (await getAdminListing(sql, ids.az0001!))!;
    expect(
      await saveListing(sql, { id: ids.az0001!, patch: current, approve: true, ...ADMIN }),
    ).toMatchObject({ ok: true });
    expect(await anonSees(ids.az0001!)).toBe(true);
  });

  it("another listing of the same phone reuses the seller", async () => {
    await createInvite(sql, { listingId: ids.az0003!, actor: ADMIN.actor, now: NOW });
    const result = await acceptInvite(sql, {
      key: KEY,
      code: await codeFor("az0003"),
      now: NOW,
      form: form({ name: "Outro nome", phone: "(41) 90000-0802", email: "" }),
    });
    expect(result).toEqual({ ok: true, authorized: 1 });
    const sellers = await sql`select id from sellers where phone_e164 = '+5541900000802'`;
    expect(sellers).toHaveLength(1);
  });

  it("a seller who declines: the listing is rejected, on the page or through the admin", async () => {
    await createInvite(sql, { listingId: ids.az0004!, actor: ADMIN.actor, now: NOW });
    const code = await codeFor("az0004");
    expect(await declineInvite(sql, { key: KEY, code, reason: "Já vendi", now: NOW })).toEqual({
      ok: true,
    });
    const [row] = await sql<{ status: string; review_note: string }[]>`
      select status, review_note from listings where id = ${ids.az0004!}`;
    expect(row).toEqual({
      status: "rejected",
      review_note: "Vendedor não autorizou a intermediação",
    });
    expect(await getOutreach(sql, ids.az0004!)).toMatchObject({
      status: "declined",
      declineReason: "Já vendi",
    });
    expect((await loadInvite(sql, KEY, code, NOW)).kind).toBe("declined");

    // Registered by the admin (the seller answered on WhatsApp), even before any invite.
    await sql`update listings set status = 'pending_review', rejected_at = null where id = ${ids.az0004!}`;
    await sql`delete from listing_outreach where listing_id = ${ids.az0004!}`;
    expect(
      await recordDecline(sql, {
        listingId: ids.az0004!,
        actor: ADMIN.actor,
        reason: "",
        now: NOW,
      }),
    ).toEqual({ ok: true });
    expect((await getOutreach(sql, ids.az0004!)).status).toBe("declined");
    expect(
      await recordDecline(sql, { listingId: ids.az0001!, actor: ADMIN.actor, now: NOW }),
    ).toMatchObject({ ok: false });
  });
});
