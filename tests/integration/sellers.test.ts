import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { approveClaim, rejectClaim } from "@/lib/admin/claims";
import { createRemovalRequest } from "@/lib/removals/create";
import { testUserId } from "@/lib/sellers/access";
import {
  acceptTerms,
  claimState,
  createClaim,
  getSellerByAuthUser,
  markListingSold,
  saveSellerProfile,
  sellerListingLeads,
  sellerListings,
} from "@/lib/sellers/data";

const url = process.env.TEST_DATABASE_URL;
const ADMIN = "admin:admin.teste@example.com";

describe.skipIf(!url)("sellers, claims and removals (database)", () => {
  let sql: postgres.Sql;
  const listings: string[] = [];
  const sellers: string[] = [];

  const listing = async (suffix: string, phone = "+5541900000501") => {
    const [{ id }] = await sql<{ id: string }[]>`
      insert into listings (slug, status, origin, model_id, engine_id, year_model, price_cents,
        contact_phone_e164)
      values (${`volvo-xc90-t8-2021-teste-${suffix}`}, 'active', 'instagram', 'xc90', 't8', 2021,
        32000000, ${phone})
      returning id`;
    listings.push(id);
    return id;
  };
  const profile = async (email: string, name: string) => {
    const result = await saveSellerProfile(sql, {
      authUserId: testUserId(email),
      email,
      displayName: name,
      type: "loja",
      phone: "",
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    sellers.push(result.sellerId);
    return result.sellerId;
  };

  beforeAll(() => {
    sql = postgres(url!, { max: 2, onnotice: () => {} });
  });

  afterAll(async () => {
    await sql`delete from removal_requests where listing_id = any(${listings})`;
    await sql.begin(async (tx) => {
      await tx`set local buymyvolvo.allow_lead_delete = 'on'`;
      await tx`delete from leads where listing_id = any(${listings})`;
    });
    await sql`delete from listings where id = any(${listings})`;
    await sql`delete from sellers where id = any(${sellers})`;
    await sql`update app_settings set value = '3' where key = 'removal_requests_per_day'`;
    await sql.end();
  });

  it("a public removal takes the listing down at once, with a per-device limit", async () => {
    const id = await listing("sl001");
    const base = {
      slug: "volvo-xc90-t8-2021-teste-sl001",
      detail: "",
      contact: "",
      ipHash: "hash-a",
    };
    expect(await createRemovalRequest(sql, { ...base, reason: "Qualquer" })).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(await createRemovalRequest(sql, { ...base, reason: "Outro motivo" })).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(
      await createRemovalRequest(sql, {
        ...base,
        slug: "nao-existe-xyz",
        reason: "Já vendi o carro",
      }),
    ).toMatchObject({
      code: "not_found",
    });

    const done = await createRemovalRequest(sql, {
      ...base,
      reason: "Já vendi o carro",
      contact: "dono@example.com",
    });
    expect(done).toMatchObject({ ok: true, alreadyRemoved: false });
    const [row] = await sql<{ status: string }[]>`select status from listings where id = ${id}`;
    expect(row?.status).toBe("removed");
    const [request] = await sql<{ reason: string; requester_ip_hash: string; status: string }[]>`
      select reason, requester_ip_hash, status from removal_requests where listing_id = ${id}`;
    expect(request).toEqual({
      reason: "Já vendi o carro",
      requester_ip_hash: "hash-a",
      status: "pending",
    });
    expect(await createRemovalRequest(sql, { ...base, reason: "Já vendi o carro" })).toEqual({
      ok: true,
      requestId: null,
      alreadyRemoved: true,
    });

    await sql`update app_settings set value = '1' where key = 'removal_requests_per_day'`;
    await listing("sl002");
    expect(
      await createRemovalRequest(sql, {
        ...base,
        slug: "volvo-xc90-t8-2021-teste-sl002",
        reason: "Já vendi o carro",
      }),
    ).toMatchObject({ ok: false, code: "rate_limited" });
  });

  it("validates the seller profile and records the terms version", async () => {
    const bad = await saveSellerProfile(sql, {
      authUserId: testUserId("x@example.com"),
      email: "x@example.com",
      displayName: "A",
      type: "outro",
      phone: "123",
    });
    expect(bad.ok === false && Object.keys(bad.errors).sort()).toEqual([
      "displayName",
      "phone",
      "type",
    ]);

    const sellerId = await profile("loja.a@example.com", "Loja A");
    expect(await profile("loja.a@example.com", "Loja A Renomeada")).toBe(sellerId);
    await acceptTerms(sql, { sellerId, terms: "seller_terms", version: "v-teste" });
    await acceptTerms(sql, { sellerId, terms: "seller_terms", version: "v-teste" });
    const seller = await getSellerByAuthUser(sql, testUserId("loja.a@example.com"));
    expect(seller).toMatchObject({
      displayName: "Loja A Renomeada",
      termsVersionAccepted: "v-teste",
      plan: "free",
    });
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from terms_acceptances where seller_id = ${sellerId}`;
    expect(n).toBe(1);
  });

  it("claim → admin approval makes the listing, its leads and the badge the seller's", async () => {
    const id = await listing("sl003");
    const a = await profile("loja.b@example.com", "Loja B");
    const b = await profile("loja.c@example.com", "Loja C");
    await sql`insert into leads (listing_id, ref_code, channel) values (${id}, 'VX-SL301', 'whatsapp'), (${id}, 'VX-SL302', 'whatsapp')`;

    const claimA = await createClaim(sql, {
      sellerId: a,
      listingId: id,
      evidence: "@lojab",
      actor: `seller:${a}`,
    });
    expect(claimA).toMatchObject({ ok: true, code: expect.stringMatching(/^RV-/) });
    const again = await createClaim(sql, {
      sellerId: a,
      listingId: id,
      evidence: "",
      actor: `seller:${a}`,
    });
    expect(again.ok && claimA.ok && again.code).toBe(claimA.ok && claimA.code);
    const claimB = await createClaim(sql, {
      sellerId: b,
      listingId: id,
      evidence: "",
      actor: `seller:${b}`,
    });
    expect(await claimState(sql, { listingId: id, sellerId: a })).toMatchObject({
      kind: "pending",
    });

    if (!claimA.ok || !claimB.ok) throw new Error("expected claims");
    expect(await rejectClaim(sql, { id: claimA.claimId, actor: ADMIN, note: "" })).toMatchObject({
      ok: false,
    });
    expect(await approveClaim(sql, { id: claimA.claimId, actor: ADMIN })).toEqual({ ok: true });
    expect(await approveClaim(sql, { id: claimA.claimId, actor: ADMIN })).toMatchObject({
      ok: false,
    });

    expect(await claimState(sql, { listingId: id, sellerId: a })).toEqual({ kind: "mine" });
    expect(await claimState(sql, { listingId: id, sellerId: b })).toEqual({ kind: "other" });
    const [other] = await sql<
      { status: string }[]
    >`select status from listing_claims where id = ${claimB.claimId}`;
    expect(other?.status).toBe("rejected");
    const leadSellers = await sql<
      { seller_id: string }[]
    >`select seller_id from leads where listing_id = ${id}`;
    expect(leadSellers.every((l) => l.seller_id === a)).toBe(true);
    expect((await getSellerByAuthUser(sql, testUserId("loja.b@example.com")))?.verifiedVia).toBe(
      "manual",
    );
    expect((await sellerListings(sql, a)).map((l) => l.id)).toEqual([id]);
    expect(await sellerListingLeads(sql, { sellerId: b, listingId: id })).toEqual([]);
    expect(
      await createClaim(sql, { sellerId: b, listingId: id, evidence: "", actor: `seller:${b}` }),
    ).toMatchObject({ ok: false });
  });

  it("marking as sold feeds the leads' outcome", async () => {
    const id = await listing("sl004");
    const seller = await profile("loja.d@example.com", "Loja D");
    await sql`update listings set seller_id = ${seller}, is_claimed = true where id = ${id}`;
    await sql`insert into leads (listing_id, ref_code, channel) values (${id}, 'VX-SL401', 'whatsapp'), (${id}, 'VX-SL402', 'instagram')`;

    const other = await profile("loja.e@example.com", "Loja E");
    expect(
      await markListingSold(sql, {
        sellerId: other,
        listingId: id,
        answer: "sim",
        leadRef: null,
        actor: "seller:x",
      }),
    ).toMatchObject({ ok: false, error: "Anúncio não encontrado." });
    expect(
      await markListingSold(sql, {
        sellerId: seller,
        listingId: id,
        answer: "sim",
        leadRef: "VX-NOPE1",
        actor: "seller:x",
      }),
    ).toMatchObject({ ok: false });
    expect(
      await markListingSold(sql, {
        sellerId: seller,
        listingId: id,
        answer: "sim",
        leadRef: "VX-SL402",
        actor: `seller:${seller}`,
      }),
    ).toEqual({ ok: true });

    const outcomes = await sql<{ ref_code: string; outcome: string }[]>`
      select ref_code, outcome from leads where listing_id = ${id} order by ref_code`;
    expect(outcomes).toEqual([
      { ref_code: "VX-SL401", outcome: "not_sold" },
      { ref_code: "VX-SL402", outcome: "sold_via_site" },
    ]);
    const [row] = await sql<{ status: string; sold_via_site: boolean }[]>`
      select status, sold_via_site from listings where id = ${id}`;
    expect(row).toEqual({ status: "sold", sold_via_site: true });
    expect(
      await markListingSold(sql, {
        sellerId: seller,
        listingId: id,
        answer: "nao",
        leadRef: null,
        actor: "seller:x",
      }),
    ).toMatchObject({ ok: false, error: "Só anúncios no ar podem ser marcados como vendidos." });
  });
});
