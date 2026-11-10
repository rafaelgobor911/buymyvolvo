/**
 * Seller profiles, terms acceptance, claims and the seller panel's data.
 * Receives `sql` by parameter (like the jobs); callers check the session first.
 */
import type postgres from "postgres";

import { normalizePhoneBR } from "@/lib/extraction/normalize";

import { generateClaimCode } from "./access";
import type { SellerEdit } from "./edit-form";

type Sql = postgres.Sql;

export interface SellerProfile {
  id: string;
  displayName: string;
  type: "loja" | "particular";
  email: string | null;
  phone: string | null;
  plan: string;
  termsVersionAccepted: string | null;
  verifiedVia: string | null;
}

export async function getSellerByAuthUser(
  sql: Sql,
  authUserId: string,
): Promise<SellerProfile | null> {
  const [row] = await sql<SellerProfile[]>`
    select id, display_name as "displayName", type, email, phone_e164 as phone,
      coalesce(plan, 'free') as plan, terms_version_accepted as "termsVersionAccepted",
      verified_via as "verifiedVia"
    from public.sellers where auth_user_id = ${authUserId}`;
  return row ?? null;
}

export type ProfileResult =
  { ok: true; sellerId: string } | { ok: false; errors: Record<string, string> };

/** Creates the seller on the first claim, or updates name, type and phone. */
export async function saveSellerProfile(
  sql: Sql,
  input: { authUserId: string; email: string; displayName: string; type: string; phone: string },
): Promise<ProfileResult> {
  const errors: Record<string, string> = {};
  const displayName = input.displayName.trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 80) {
    errors.displayName = "Informe um nome de 2 a 80 caracteres (o seu ou o da loja).";
  }
  if (input.type !== "loja" && input.type !== "particular")
    errors.type = "Escolha loja ou particular.";
  const phone = input.phone.trim() ? normalizePhoneBR(input.phone) : null;
  if (input.phone.trim() && !phone) errors.phone = "Telefone brasileiro inválido (DDD + número).";
  if (Object.keys(errors).length) return { ok: false, errors };

  const [row] = await sql<{ id: string }[]>`
    insert into public.sellers (display_name, type, email, phone_e164, auth_user_id, plan)
    values (${displayName}, ${input.type}, ${input.email}, ${phone}, ${input.authUserId}, 'free')
    on conflict (auth_user_id) do update set
      display_name = excluded.display_name, type = excluded.type,
      phone_e164 = coalesce(excluded.phone_e164, public.sellers.phone_e164),
      email = excluded.email
    returning id`;
  return { ok: true, sellerId: row!.id };
}

export async function acceptTerms(
  sql: Sql,
  input: { sellerId: string; terms: "seller_terms" | "photo_license"; version: string },
) {
  await sql.begin(async (tx) => {
    await tx`
      insert into public.terms_acceptances (seller_id, terms, version)
      values (${input.sellerId}, ${input.terms}, ${input.version})
      on conflict (seller_id, terms, version) do nothing`;
    if (input.terms === "seller_terms") {
      await tx`
        update public.sellers set terms_version_accepted = ${input.version}, terms_accepted_at = now()
        where id = ${input.sellerId}`;
    }
  });
}

export interface Claim {
  id: string;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  evidence: string | null;
  decisionNote: string | null;
  createdAt: Date;
}

const CLAIM_SELECT = (sql: Sql) => sql`
  select c.id, c.listing_id as "listingId", l.slug as "listingSlug",
    concat_ws(' ', m.name, e.name, t.name, l.year_model::text) as "listingTitle",
    c.code, c.status, c.evidence, c.decision_note as "decisionNote", c.created_at as "createdAt"
  from public.listing_claims c
  join public.listings l on l.id = c.listing_id
  join public.vehicle_models m on m.id = l.model_id
  left join public.vehicle_engines e on e.id = l.engine_id
  left join public.vehicle_trims t on t.id = l.trim_id`;

export async function sellerClaims(sql: Sql, sellerId: string): Promise<Claim[]> {
  return sql<
    Claim[]
  >`${CLAIM_SELECT(sql)} where c.seller_id = ${sellerId} order by c.created_at desc limit 50`;
}

export type ClaimState =
  | { kind: "mine" }
  | { kind: "other" }
  | { kind: "pending"; claim: Claim }
  | { kind: "open"; lastRejected: Claim | null };

/** Where this seller stands with this listing. */
export async function claimState(
  sql: Sql,
  input: { listingId: string; sellerId: string | null },
): Promise<ClaimState> {
  const [listing] = await sql<{ seller_id: string | null; is_claimed: boolean }[]>`
    select seller_id, is_claimed from public.listings where id = ${input.listingId}`;
  if (listing?.is_claimed)
    return listing.seller_id === input.sellerId ? { kind: "mine" } : { kind: "other" };
  if (!input.sellerId) return { kind: "open", lastRejected: null };
  const claims = await sql<Claim[]>`
    ${CLAIM_SELECT(sql)} where c.listing_id = ${input.listingId} and c.seller_id = ${input.sellerId}
    order by c.created_at desc limit 1`;
  const last = claims[0] ?? null;
  if (last?.status === "pending") return { kind: "pending", claim: last };
  return { kind: "open", lastRejected: last?.status === "rejected" ? last : null };
}

export type ClaimResult =
  { ok: true; claimId: string; code: string } | { ok: false; error: string };

export async function createClaim(
  sql: Sql,
  input: { sellerId: string; listingId: string; evidence: string; actor: string },
): Promise<ClaimResult> {
  const evidence = input.evidence.trim().slice(0, 1000) || null;
  return sql.begin(async (tx) => {
    const [listing] = await tx<{ status: string; is_claimed: boolean; seller_id: string | null }[]>`
      select status, is_claimed, seller_id from public.listings where id = ${input.listingId} for update`;
    if (!listing || !["active", "sold", "expired"].includes(listing.status)) {
      return { ok: false, error: "Este anúncio não está disponível para reivindicação." };
    }
    if (listing.is_claimed) {
      return listing.seller_id === input.sellerId
        ? { ok: false, error: "Este anúncio já é seu." }
        : { ok: false, error: "Este anúncio já foi reivindicado. Se ele é seu, fale com a gente." };
    }
    const [pending] = await tx<{ id: string; code: string }[]>`
      select id, code from public.listing_claims
      where listing_id = ${input.listingId} and seller_id = ${input.sellerId} and status = 'pending'`;
    if (pending) return { ok: true, claimId: pending.id, code: pending.code };
    for (let attempt = 0; attempt < 5; attempt++) {
      const [row] = await tx<{ id: string; code: string }[]>`
        insert into public.listing_claims (listing_id, seller_id, method, code, evidence)
        values (${input.listingId}, ${input.sellerId}, 'manual', ${generateClaimCode()}, ${evidence})
        on conflict (code) do nothing returning id, code`;
      if (row) {
        await tx`
          insert into public.audit_log (actor, action, entity, entity_id, changes)
          values (${input.actor}, 'claim.create', 'listing_claim', ${row.id},
            ${tx.json({ listing: { from: null, to: input.listingId } })})`;
        return { ok: true, claimId: row.id, code: row.code };
      }
    }
    throw new Error("Could not generate a unique claim code.");
  });
}

// --- Seller panel ---------------------------------------------------------------

export interface SellerListing {
  id: string;
  slug: string;
  shortId: string;
  title: string;
  status: string;
  priceCents: number | null;
  views30d: number;
  leads: number;
  soldViaSite: boolean | null;
}

export async function sellerListings(sql: Sql, sellerId: string): Promise<SellerListing[]> {
  const rows = await sql<(Omit<SellerListing, "priceCents"> & { priceCents: string | null })[]>`
    select l.id, l.slug, l.short_id as "shortId",
      concat_ws(' ', m.name, e.name, t.name, l.year_model::text) as title, l.status,
      l.price_cents as "priceCents", l.sold_via_site as "soldViaSite",
      (select coalesce(sum(v.views), 0)::int from public.listing_views_daily v
        where v.listing_id = l.id and v.day > current_date - 30) as "views30d",
      (select count(*)::int from public.leads ld where ld.listing_id = l.id) as leads
    from public.listings l
    join public.vehicle_models m on m.id = l.model_id
    left join public.vehicle_engines e on e.id = l.engine_id
    left join public.vehicle_trims t on t.id = l.trim_id
    where l.seller_id = ${sellerId} and l.is_claimed
    order by (l.status = 'active') desc, l.updated_at desc`;
  return rows.map((r) => ({
    ...r,
    priceCents: r.priceCents === null ? null : Number(r.priceCents),
  }));
}

export interface SellerLead {
  refCode: string;
  channel: "whatsapp" | "instagram";
  createdAt: Date;
  clickCount: number;
  outcome: "unknown" | "sold_via_site" | "not_sold";
}

/** Contacts of one of the seller's listings: code, channel and date only (no buyer data). */
export async function sellerListingLeads(
  sql: Sql,
  input: { sellerId: string; listingId: string },
): Promise<SellerLead[]> {
  return sql<SellerLead[]>`
    select ld.ref_code as "refCode", ld.channel, ld.created_at as "createdAt",
      ld.click_count as "clickCount", ld.outcome
    from public.leads ld
    join public.listings l on l.id = ld.listing_id
    where ld.listing_id = ${input.listingId} and l.seller_id = ${input.sellerId}
    order by ld.created_at desc limit 200`;
}

export type SoldAnswer = "sim" | "nao" | "nao_sei";
export type SoldResult = { ok: true } | { ok: false; error: string };

/**
 * "Marcar como vendido" with the question "Vendeu para alguém que chegou pelo
 * site?". The answer feeds leads.outcome, the basis of any commission.
 */
export async function markListingSold(
  sql: Sql,
  input: {
    sellerId: string;
    listingId: string;
    answer: SoldAnswer;
    leadRef: string | null;
    actor: string;
  },
): Promise<SoldResult> {
  if (!["sim", "nao", "nao_sei"].includes(input.answer)) {
    return { ok: false, error: "Responda se o comprador chegou pelo site." };
  }
  return sql.begin(async (tx) => {
    const [listing] = await tx<{ status: string; seller_id: string | null }[]>`
      select status, seller_id from public.listings where id = ${input.listingId} for update`;
    if (!listing || listing.seller_id !== input.sellerId)
      return { ok: false, error: "Anúncio não encontrado." };
    if (listing.status !== "active")
      return { ok: false, error: "Só anúncios no ar podem ser marcados como vendidos." };

    let soldViaSite: boolean | null = null;
    if (input.answer === "sim") {
      soldViaSite = true;
      if (input.leadRef) {
        const rows = await tx`
          update public.leads set outcome = 'sold_via_site', outcome_reported_at = now()
          where listing_id = ${input.listingId} and ref_code = ${input.leadRef} returning id`;
        if (!rows.length)
          return { ok: false, error: "Esse código de contato não é deste anúncio." };
        await tx`
          update public.leads set outcome = 'not_sold', outcome_reported_at = now()
          where listing_id = ${input.listingId} and ref_code <> ${input.leadRef} and outcome = 'unknown'`;
      }
    } else if (input.answer === "nao") {
      soldViaSite = false;
      await tx`
        update public.leads set outcome = 'not_sold', outcome_reported_at = now()
        where listing_id = ${input.listingId} and outcome = 'unknown'`;
    }
    await tx`
      update public.listings set status = 'sold', sold_at = now(), sold_via_site = ${soldViaSite}
      where id = ${input.listingId}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes, note)
      values (${input.actor}, 'listing.sold', 'listing', ${input.listingId},
        ${tx.json({ status: { from: "active", to: "sold" }, soldViaSite: { from: null, to: soldViaSite } })},
        ${input.leadRef ? `Contato ${input.leadRef}` : null})`;
    return { ok: true };
  });
}

// --- Editing a claimed listing ----------------------------------------------------

export interface SellerEditableListing extends SellerEdit {
  id: string;
  slug: string;
  shortId: string;
  title: string;
  status: string;
}

/** The seller's own claimed listing, or null (also when it belongs to someone else). */
export async function sellerEditableListing(
  sql: Sql,
  input: { sellerId: string; listingId: string },
): Promise<SellerEditableListing | null> {
  if (!/^[0-9a-f-]{36}$/i.test(input.listingId)) return null;
  const [row] = await sql<
    (Omit<SellerEditableListing, "priceCents"> & { priceCents: string | null })[]
  >`
    select l.id, l.slug, l.short_id as "shortId", l.status,
      concat_ws(' ', m.name, e.name, t.name, l.year_model::text) as title,
      l.price_cents as "priceCents", l.km, l.color, l.transmission, l.fuel, l.city, l.uf,
      l.contact_phone_e164 as phone, l.contact_ig_username as "igUsername",
      l.seller_description as description, coalesce(l.options, '{}') as options
    from public.listings l
    join public.vehicle_models m on m.id = l.model_id
    left join public.vehicle_engines e on e.id = l.engine_id
    left join public.vehicle_trims t on t.id = l.trim_id
    where l.id = ${input.listingId} and l.seller_id = ${input.sellerId} and l.is_claimed`;
  return row
    ? { ...row, priceCents: row.priceCents === null ? null : Number(row.priceCents) }
    : null;
}

export type SellerUpdateResult = { ok: true; changed: number } | { ok: false; error: string };

/** Saves the seller's edits; the change list goes to audit_log. */
export async function updateSellerListing(
  sql: Sql,
  input: { sellerId: string; listingId: string; edit: SellerEdit; actor: string },
): Promise<SellerUpdateResult> {
  const current = await sellerEditableListing(sql, input);
  if (!current) return { ok: false, error: "Anúncio não encontrado." };
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(input.edit) as (keyof SellerEdit)[]) {
    if (JSON.stringify(current[key]) !== JSON.stringify(input.edit[key])) {
      changes[key] = { from: current[key], to: input.edit[key] };
    }
  }
  if (Object.keys(changes).length === 0) return { ok: true, changed: 0 };
  const e = input.edit;
  await sql.begin(async (tx) => {
    await tx`
      update public.listings set
        price_cents = ${e.priceCents}, km = ${e.km}, color = ${e.color},
        transmission = ${e.transmission}, fuel = ${e.fuel}, city = ${e.city}, uf = ${e.uf},
        uf_from_ddd = coalesce(uf_from_ddd and uf is not distinct from ${e.uf}
          and ${e.city}::text is null, false),
        contact_phone_e164 = ${e.phone}, contact_ig_username = ${e.igUsername},
        seller_description = ${e.description}, options = ${e.options}
      where id = ${input.listingId} and seller_id = ${input.sellerId}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'listing.seller_update', 'listing', ${input.listingId},
        ${tx.json(changes as postgres.JSONValue)})`;
  });
  return { ok: true, changed: Object.keys(changes).length };
}

export async function hasAcceptedTerms(
  sql: Sql,
  input: { sellerId: string; terms: "seller_terms" | "photo_license"; version: string },
): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`
    select exists (select 1 from public.terms_acceptances
      where seller_id = ${input.sellerId} and terms = ${input.terms} and version = ${input.version}) as ok`;
  return row?.ok ?? false;
}
