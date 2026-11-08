/**
 * Blocklist (no re-import of removed listings, posts, phones or @) and
 * seller removal requests. Receives `sql` by parameter; every change goes to
 * audit_log.
 */
import type postgres from "postgres";

import { normalizePhoneBR } from "@/lib/extraction/normalize";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

export const BLOCK_KINDS = ["phone", "ig_username", "ig_media_id"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  phone: "Telefone",
  ig_username: "Instagram (@)",
  ig_media_id: "Post do Instagram (id)",
};

/** Normalized blocklist value, or null when it is not valid for the kind. */
export function normalizeBlockValue(kind: BlockKind, raw: string): string | null {
  const value = raw.trim();
  if (kind === "phone") {
    // Already stored E.164 values (demo DDD 20 included) are kept as they are.
    if (/^\+[1-9]\d{7,14}$/.test(value)) return value;
    return normalizePhoneBR(value);
  }
  if (kind === "ig_username") {
    const u = value.replace(/^@/, "").toLowerCase();
    return /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
  }
  return /^[A-Za-z0-9_-]{3,64}$/.test(value) ? value : null;
}

/**
 * Blocks a listing's phone, @ and source posts, so neither the same posts nor
 * new posts with that contact come back. Returns how many entries were new.
 */
export async function blockListingContacts(
  tx: Tx,
  listingId: string,
  input: { reason: string; removalRequestId?: string | null },
): Promise<number> {
  const [listing] = await tx<{ phone: string | null; ig: string | null }[]>`
    select contact_phone_e164 as phone, contact_ig_username as ig
    from public.listings where id = ${listingId}`;
  if (!listing) return 0;
  const posts = await tx<{ ig_media_id: string; ig_username: string | null }[]>`
    select rp.ig_media_id, rp.ig_username from public.listing_sources ls
    join public.raw_posts rp on rp.id = ls.raw_post_id where ls.listing_id = ${listingId}`;
  const entries: Array<[BlockKind, string]> = [];
  if (listing.phone) entries.push(["phone", listing.phone]);
  const usernames = new Set(
    [listing.ig, ...posts.map((p) => p.ig_username)].filter((u): u is string => !!u),
  );
  for (const u of usernames) entries.push(["ig_username", u.toLowerCase()]);
  for (const p of posts) entries.push(["ig_media_id", p.ig_media_id]);
  let added = 0;
  for (const [kind, value] of entries) {
    const rows = await tx`
      insert into public.blocklist (kind, value, reason, removal_request_id)
      values (${kind}, ${value}, ${input.reason}, ${input.removalRequestId ?? null})
      on conflict (kind, value) do nothing returning id`;
    added += rows.length;
  }
  return added;
}

export interface BlockEntry {
  id: string;
  kind: BlockKind;
  value: string;
  reason: string | null;
  createdAt: Date;
  removalRequestId: string | null;
}

export async function listBlocklist(sql: Sql, q = ""): Promise<BlockEntry[]> {
  const like = `%${q
    .trim()
    .toLowerCase()
    .replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return sql<BlockEntry[]>`
    select id, kind, value, reason, created_at as "createdAt", removal_request_id as "removalRequestId"
    from public.blocklist
    where ${q.trim() ? sql`lower(value) like ${like} or lower(coalesce(reason, '')) like ${like}` : sql`true`}
    order by created_at desc limit 300`;
}

export type BlockResult = { ok: true; added: boolean } | { ok: false; error: string };

export async function addBlock(
  sql: Sql,
  input: { kind: string; value: string; reason: string; actor: string },
): Promise<BlockResult> {
  if (!BLOCK_KINDS.includes(input.kind as BlockKind)) return { ok: false, error: "Tipo inválido." };
  const kind = input.kind as BlockKind;
  const value = normalizeBlockValue(kind, input.value);
  if (!value) return { ok: false, error: `${BLOCK_KIND_LABELS[kind]} inválido.` };
  const reason = input.reason.trim().slice(0, 300) || "Bloqueado pelo admin";
  return sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      insert into public.blocklist (kind, value, reason) values (${kind}, ${value}, ${reason})
      on conflict (kind, value) do nothing returning id`;
    if (rows.length) {
      await tx`
        insert into public.audit_log (actor, action, entity, entity_id, changes, note)
        values (${input.actor}, 'blocklist.add', 'blocklist', ${rows[0]!.id},
          ${tx.json({ kind: { from: null, to: kind }, value: { from: null, to: value } })}, ${reason})`;
    }
    return { ok: true, added: rows.length > 0 };
  });
}

/** Unblocking lets the next collection import that contact or post again. */
export async function removeBlock(sql: Sql, input: { id: string; actor: string }) {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ kind: string; value: string }[]>`
      delete from public.blocklist where id = ${input.id} returning kind, value`;
    if (!row) return false;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'blocklist.remove', 'blocklist', ${input.id},
        ${tx.json({ kind: { from: row.kind, to: null }, value: { from: row.value, to: null } })})`;
    return true;
  });
}

// --- Removal requests --------------------------------------------------------

export interface RemovalRequest {
  id: string;
  listingId: string;
  listingTitle: string;
  listingShortId: string;
  listingStatus: string;
  requesterContact: string | null;
  reason: string | null;
  status: "pending" | "confirmed" | "rejected";
  createdAt: Date;
  processedAt: Date | null;
  processedBy: string | null;
  /** Hours since the request (the deadline is 48h). */
  hoursOpen: number;
}

export async function listRemovalRequests(sql: Sql): Promise<RemovalRequest[]> {
  return sql<RemovalRequest[]>`
    select r.id, r.listing_id as "listingId",
      concat_ws(' ', m.name, e.name, t.name, l.year_model::text) as "listingTitle",
      l.short_id as "listingShortId", l.status as "listingStatus",
      r.requester_contact as "requesterContact", r.reason, r.status,
      r.created_at as "createdAt", r.processed_at as "processedAt", r.processed_by as "processedBy",
      floor(extract(epoch from now() - r.created_at) / 3600)::int as "hoursOpen"
    from public.removal_requests r
    join public.listings l on l.id = r.listing_id
    join public.vehicle_models m on m.id = l.model_id
    left join public.vehicle_engines e on e.id = l.engine_id
    left join public.vehicle_trims t on t.id = l.trim_id
    order by (r.status = 'pending') desc, r.created_at desc
    limit 200`;
}

export type RemovalResult = { ok: true; blocked: number } | { ok: false; error: string };

/**
 * Confirms a seller's removal: the listing stays removed for good and its
 * contact and posts go to the blocklist (LGPD: processed within 48h).
 */
export async function confirmRemoval(
  sql: Sql,
  input: { id: string; actor: string },
): Promise<RemovalResult> {
  return sql.begin(async (tx) => {
    const [request] = await tx<{ listing_id: string; status: string }[]>`
      select listing_id, status from public.removal_requests where id = ${input.id} for update`;
    if (!request) return { ok: false, error: "Pedido não encontrado." };
    if (request.status !== "pending") return { ok: false, error: "Este pedido já foi processado." };
    const [listing] = await tx<{ status: string }[]>`
      select status from public.listings where id = ${request.listing_id} for update`;
    if (listing && listing.status !== "removed") {
      await tx`
        update public.listings set status = 'removed', removed_at = now()
        where id = ${request.listing_id}`;
      await tx`
        insert into public.audit_log (actor, action, entity, entity_id, changes, note)
        values (${input.actor}, 'listing.status', 'listing', ${request.listing_id},
          ${tx.json({ status: { from: listing.status, to: "removed" } })}, 'Pedido de remoção confirmado')`;
    }
    const blocked = await blockListingContacts(tx, request.listing_id, {
      reason: "Pedido de remoção do vendedor",
      removalRequestId: input.id,
    });
    await tx`
      update public.removal_requests set status = 'confirmed', processed_at = now(),
        processed_by = ${input.actor}
      where id = ${input.id}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'removal.confirm', 'removal_request', ${input.id},
        ${tx.json({ status: { from: "pending", to: "confirmed" }, blocked: { from: 0, to: blocked } })})`;
    return { ok: true, blocked };
  });
}

/**
 * Declines a request that is not legitimate (e.g. not the seller). A listing
 * taken down by this request goes back up.
 */
export async function rejectRemoval(
  sql: Sql,
  input: { id: string; actor: string; note: string },
): Promise<RemovalResult> {
  const note = input.note.trim().slice(0, 300);
  if (!note) return { ok: false, error: "Diga por que o pedido foi recusado." };
  return sql.begin(async (tx) => {
    const [request] = await tx<{ listing_id: string; status: string; created_at: Date }[]>`
      select listing_id, status, created_at from public.removal_requests
      where id = ${input.id} for update`;
    if (!request) return { ok: false, error: "Pedido não encontrado." };
    if (request.status !== "pending") return { ok: false, error: "Este pedido já foi processado." };
    const restored = await tx<{ status: string }[]>`
      update public.listings set
        status = case when year_model is not null and (price_cents is not null
          or contact_phone_e164 is not null or contact_ig_username is not null)
          then 'active' else 'pending_review' end,
        removed_at = null
      where id = ${request.listing_id} and status = 'removed' and removed_at >= ${request.created_at}
      returning status`;
    if (restored[0]) {
      await tx`
        insert into public.audit_log (actor, action, entity, entity_id, changes, note)
        values (${input.actor}, 'listing.status', 'listing', ${request.listing_id},
          ${tx.json({ status: { from: "removed", to: restored[0].status } })}, 'Pedido de remoção recusado')`;
    }
    await tx`
      update public.removal_requests set status = 'rejected', processed_at = now(),
        processed_by = ${input.actor}
      where id = ${input.id}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes, note)
      values (${input.actor}, 'removal.reject', 'removal_request', ${input.id},
        ${tx.json({ status: { from: "pending", to: "rejected" } })}, ${note})`;
    return { ok: true, blocked: 0 };
  });
}
