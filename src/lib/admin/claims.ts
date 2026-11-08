/**
 * Claims queue for the admin: approve (the listing becomes the seller's) or
 * reject. Receives `sql` by parameter; every decision goes to audit_log.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

export interface AdminClaim {
  id: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  evidence: string | null;
  decisionNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  listingId: string;
  listingSlug: string;
  listingTitle: string;
  listingPhone: string | null;
  listingInstagram: string | null;
  sellerId: string;
  sellerName: string;
  sellerType: string;
  sellerEmail: string | null;
  sellerPhone: string | null;
}

export async function listClaims(sql: Sql): Promise<AdminClaim[]> {
  return sql<AdminClaim[]>`
    select c.id, c.code, c.status, c.evidence, c.decision_note as "decisionNote",
      c.created_at as "createdAt", c.decided_at as "decidedAt", c.decided_by as "decidedBy",
      l.id as "listingId", l.slug as "listingSlug",
      concat_ws(' ', m.name, e.name, t.name, l.year_model::text) as "listingTitle",
      l.contact_phone_e164 as "listingPhone",
      coalesce(l.contact_ig_username, (
        select rp.ig_username from public.listing_sources ls
        join public.raw_posts rp on rp.id = ls.raw_post_id
        where ls.listing_id = l.id and rp.ig_username is not null limit 1)) as "listingInstagram",
      s.id as "sellerId", s.display_name as "sellerName", s.type as "sellerType",
      s.email as "sellerEmail", s.phone_e164 as "sellerPhone"
    from public.listing_claims c
    join public.listings l on l.id = c.listing_id
    join public.vehicle_models m on m.id = l.model_id
    left join public.vehicle_engines e on e.id = l.engine_id
    left join public.vehicle_trims t on t.id = l.trim_id
    join public.sellers s on s.id = c.seller_id
    order by (c.status = 'pending') desc, c.created_at desc
    limit 200`;
}

export type ClaimDecision = { ok: true } | { ok: false; error: string };

/** The listing becomes the seller's: verified badge, panel, and its leads. */
export async function approveClaim(
  sql: Sql,
  input: { id: string; actor: string },
): Promise<ClaimDecision> {
  return sql.begin(async (tx) => {
    const [claim] = await tx<{ listing_id: string; seller_id: string; status: string }[]>`
      select listing_id, seller_id, status from public.listing_claims where id = ${input.id} for update`;
    if (!claim) return { ok: false, error: "Reivindicação não encontrada." };
    if (claim.status !== "pending")
      return { ok: false, error: "Esta reivindicação já foi decidida." };
    const [listing] = await tx<{ seller_id: string | null; is_claimed: boolean }[]>`
      select seller_id, is_claimed from public.listings where id = ${claim.listing_id} for update`;
    if (listing?.is_claimed && listing.seller_id !== claim.seller_id) {
      return { ok: false, error: "O anúncio já pertence a outro vendedor." };
    }
    await tx`
      update public.listings set seller_id = ${claim.seller_id}, is_claimed = true
      where id = ${claim.listing_id}`;
    // Past contacts of the listing now count for this seller (allowed by the leads trigger).
    await tx`update public.leads set seller_id = ${claim.seller_id} where listing_id = ${claim.listing_id}`;
    await tx`
      update public.sellers set verified_via = coalesce(verified_via, 'manual'),
        verified_at = coalesce(verified_at, now())
      where id = ${claim.seller_id}`;
    await tx`
      update public.listing_claims set status = 'approved', decided_at = now(), decided_by = ${input.actor}
      where id = ${input.id}`;
    // Other sellers waiting on the same listing are told it was confirmed for someone else.
    await tx`
      update public.listing_claims set status = 'rejected', decided_at = now(),
        decided_by = ${input.actor}, decision_note = 'O anúncio foi confirmado para outro vendedor.'
      where listing_id = ${claim.listing_id} and status = 'pending' and id <> ${input.id}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'listing.claim', 'listing', ${claim.listing_id},
        ${tx.json({
          sellerId: { from: listing?.seller_id ?? null, to: claim.seller_id },
          isClaimed: { from: listing?.is_claimed ?? false, to: true },
        })})`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'claim.approve', 'listing_claim', ${input.id},
        ${tx.json({ status: { from: "pending", to: "approved" } })})`;
    return { ok: true };
  });
}

export async function rejectClaim(
  sql: Sql,
  input: { id: string; actor: string; note: string },
): Promise<ClaimDecision> {
  const note = input.note.trim().slice(0, 500);
  if (!note) return { ok: false, error: "Diga ao vendedor por que a reivindicação foi recusada." };
  return sql.begin(async (tx) => {
    const rows = await tx`
      update public.listing_claims set status = 'rejected', decided_at = now(),
        decided_by = ${input.actor}, decision_note = ${note}
      where id = ${input.id} and status = 'pending' returning id`;
    if (!rows.length) return { ok: false, error: "Esta reivindicação já foi decidida." };
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes, note)
      values (${input.actor}, 'claim.reject', 'listing_claim', ${input.id},
        ${tx.json({ status: { from: "pending", to: "rejected" } })}, ${note})`;
    return { ok: true };
  });
}
