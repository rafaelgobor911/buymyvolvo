/**
 * Admin reads and writes on listings. Receives `sql` by parameter and does
 * not import `server-only` (like the jobs), so the integration tests run the
 * same code. Callers check the admin session first; every write is recorded
 * in audit_log, and moderation fixes also in extraction_corrections.
 */
import type postgres from "postgres";

import type { RedFlag } from "@/lib/extraction/schema";
import { listingSlug } from "@/lib/listings/format";
import { getEngine, getModel, getTrim } from "@/lib/taxonomy";

import { type ListingPatch, publishable } from "./listing-form";

type Sql = postgres.Sql;
type Tx = postgres.TransactionSql;

export const ADMIN_STATUSES = [
  "pending_review",
  "active",
  "sold",
  "expired",
  "removed",
  "rejected",
] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export const STATUS_LABELS: Record<AdminStatus, string> = {
  pending_review: "Em moderação",
  active: "No ar",
  sold: "Vendido",
  expired: "Expirado",
  removed: "Removido",
  rejected: "Rejeitado",
};

export const REJECT_REASONS = [
  "Não é anúncio de venda",
  "Não é Volvo",
  "Fora do Brasil",
  "Anúncio duplicado",
  "Dados insuficientes",
  "Suspeita de golpe",
] as const;

export interface ModerationIssue {
  code: string;
  message: string;
}

export interface AdminListing extends ListingPatch {
  id: string;
  slug: string;
  shortId: string;
  status: AdminStatus;
  origin: "instagram" | "direct";
  confidence: number | null;
  isClaimed: boolean;
  firstSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  reviewNote: string | null;
  post: {
    id: string;
    caption: string | null;
    permalink: string;
    username: string | null;
    postedAt: Date | null;
    source: string | null;
    sourceType: string | null;
    issues: ModerationIssue[];
  } | null;
}

interface ListingRow {
  id: string;
  slug: string;
  short_id: string;
  status: AdminStatus;
  origin: "instagram" | "direct";
  model_id: string;
  engine_id: string | null;
  trim_id: string | null;
  version_text: string | null;
  year_fab: number | null;
  year_model: number | null;
  km: number | null;
  price_cents: string | null;
  city: string | null;
  uf: string | null;
  color: string | null;
  transmission: ListingPatch["transmission"];
  fuel: ListingPatch["fuel"];
  seller_type: ListingPatch["sellerType"];
  contact_phone_e164: string | null;
  contact_ig_username: string | null;
  summary_ptbr: string | null;
  red_flags: RedFlag[] | null;
  options: string[] | null;
  confidence: string | null;
  is_claimed: boolean;
  first_seen_at: Date;
  created_at: Date;
  updated_at: Date;
  review_note: string | null;
}

const toPatch = (r: ListingRow): ListingPatch => ({
  modelId: r.model_id,
  engineId: r.engine_id,
  trimId: r.trim_id,
  versionText: r.version_text,
  yearFab: r.year_fab,
  yearModel: r.year_model,
  km: r.km,
  priceCents: r.price_cents === null ? null : Number(r.price_cents),
  city: r.city,
  uf: r.uf,
  color: r.color,
  transmission: r.transmission,
  fuel: r.fuel,
  sellerType: r.seller_type,
  phone: r.contact_phone_e164,
  igUsername: r.contact_ig_username,
  summary: r.summary_ptbr,
  redFlags: r.red_flags ?? [],
  options: r.options ?? [],
});

const LISTING_COLUMNS = (sql: Sql | Tx) => sql`
  l.id, l.slug, l.short_id, l.status, l.origin, l.model_id, l.engine_id, l.trim_id, l.version_text,
  l.year_fab, l.year_model, l.km, l.price_cents, l.city, l.uf, l.color, l.transmission, l.fuel,
  l.seller_type, l.contact_phone_e164, l.contact_ig_username, l.summary_ptbr, l.red_flags,
  l.options, l.confidence, l.is_claimed, l.first_seen_at, l.created_at, l.updated_at,
  l.review_note`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdminListing(sql: Sql, id: string): Promise<AdminListing | null> {
  if (!UUID.test(id)) return null;
  const [row] = await sql<
    (ListingRow & {
      post_id: string | null;
      caption: string | null;
      permalink: string | null;
      post_username: string | null;
      posted_at: Date | null;
      source_handle: string | null;
      source_type: string | null;
      extraction_json: { normalized?: { issues?: ModerationIssue[] } } | null;
    })[]
  >`
    select ${LISTING_COLUMNS(sql)}, rp.id as post_id, rp.caption, rp.permalink,
      rp.ig_username as post_username, rp.posted_at, s.handle as source_handle,
      s.type as source_type, rp.extraction_json
    from public.listings l
    left join lateral (
      select ls.raw_post_id from public.listing_sources ls
      where ls.listing_id = l.id order by ls.is_primary desc, ls.created_at limit 1
    ) primary_source on true
    left join public.raw_posts rp on rp.id = primary_source.raw_post_id
    left join public.sources s on s.id = rp.source_id
    where l.id = ${id}`;
  if (!row) return null;
  return {
    ...toPatch(row),
    id: row.id,
    slug: row.slug,
    shortId: row.short_id,
    status: row.status,
    origin: row.origin,
    confidence: row.confidence === null ? null : Number(row.confidence),
    isClaimed: row.is_claimed,
    firstSeenAt: row.first_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewNote: row.review_note,
    post: row.post_id
      ? {
          id: row.post_id,
          caption: row.caption,
          permalink: row.permalink!,
          username: row.post_username,
          postedAt: row.posted_at,
          source: row.source_handle,
          sourceType: row.source_type,
          issues: row.extraction_json?.normalized?.issues ?? [],
        }
      : null,
  };
}

export interface AdminListingRow {
  id: string;
  title: string;
  shortId: string;
  status: AdminStatus;
  yearModel: number | null;
  priceCents: number | null;
  city: string | null;
  uf: string | null;
  confidence: number | null;
  redFlags: string[];
  createdAt: Date;
  firstIssue: string | null;
}

type RowWithNames = {
  id: string;
  short_id: string;
  status: AdminStatus;
  model_name: string;
  engine_name: string | null;
  trim_name: string | null;
  year_model: number | null;
  price_cents: string | null;
  city: string | null;
  uf: string | null;
  confidence: string | null;
  red_flags: string[] | null;
  created_at: Date;
  first_issue: string | null;
};

const toRow = (r: RowWithNames): AdminListingRow => ({
  id: r.id,
  title: [r.model_name, r.engine_name, r.trim_name].filter(Boolean).join(" "),
  shortId: r.short_id,
  status: r.status,
  yearModel: r.year_model,
  priceCents: r.price_cents === null ? null : Number(r.price_cents),
  city: r.city,
  uf: r.uf,
  confidence: r.confidence === null ? null : Number(r.confidence),
  redFlags: r.red_flags ?? [],
  createdAt: r.created_at,
  firstIssue: r.first_issue,
});

const ROW_SELECT = (sql: Sql | Tx) => sql`
  select l.id, l.short_id, l.status, m.name as model_name, e.name as engine_name,
    t.name as trim_name, l.year_model, l.price_cents, l.city, l.uf, l.confidence, l.red_flags,
    l.created_at,
    (select rp.extraction_json #>> '{normalized,issues,0,message}'
       from public.listing_sources ls join public.raw_posts rp on rp.id = ls.raw_post_id
       where ls.listing_id = l.id order by ls.is_primary desc limit 1) as first_issue
  from public.listings l
  join public.vehicle_models m on m.id = l.model_id
  left join public.vehicle_engines e on e.id = l.engine_id
  left join public.vehicle_trims t on t.id = l.trim_id`;

/** Listings waiting for a moderator, oldest first. */
export async function moderationQueue(sql: Sql, limit = 100): Promise<AdminListingRow[]> {
  const rows = await sql<RowWithNames[]>`
    ${ROW_SELECT(sql)} where l.status = 'pending_review'
    order by l.created_at, l.id limit ${limit}`;
  return rows.map(toRow);
}

/** The next listing in the queue after a decision (oldest first, skipping `exceptId`). */
export async function nextInQueue(sql: Sql, exceptId: string): Promise<string | null> {
  const [row] = await sql<{ id: string }[]>`
    select id from public.listings where status = 'pending_review' and id <> ${exceptId}
    order by created_at, id limit 1`;
  return row?.id ?? null;
}

export const ADMIN_PAGE_SIZE = 30;

/** Search by short code, slug, model name, city or phone digits; any status. */
export async function searchAdminListings(
  sql: Sql,
  f: { q?: string; status?: AdminStatus | null; page?: number },
): Promise<{ items: AdminListingRow[]; total: number }> {
  const q = f.q?.trim().toLowerCase().slice(0, 80) ?? "";
  const conditions = [sql`true`];
  if (f.status) conditions.push(sql`l.status = ${f.status}`);
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const digits = q.replace(/\D/g, "");
    conditions.push(sql`(
      l.short_id = ${q} or l.slug like ${like} or lower(m.name) like ${like}
      or lower(coalesce(l.city, '')) like ${like}
      ${digits.length >= 6 ? sql`or l.contact_phone_e164 like ${`%${digits}%`}` : sql``}
    )`);
  }
  const where = conditions.reduce((acc, c) => sql`${acc} and ${c}`);
  const page = Math.max(1, f.page ?? 1);
  const rows = await sql<(RowWithNames & { total: string })[]>`
    ${ROW_SELECT(sql)}, lateral (select 1) _ where ${where}
    order by l.updated_at desc, l.id
    limit ${ADMIN_PAGE_SIZE} offset ${(page - 1) * ADMIN_PAGE_SIZE}`;
  const [{ total }] = await sql<{ total: number }[]>`
    select count(*)::int as total from public.listings l
    join public.vehicle_models m on m.id = l.model_id where ${where}`;
  return { items: rows.map(toRow), total };
}

export interface AuditEntry {
  at: Date;
  actor: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  note: string | null;
}

export async function listingHistory(sql: Sql, id: string): Promise<AuditEntry[]> {
  return sql<AuditEntry[]>`
    select at, actor, action, changes, note from public.audit_log
    where entity = 'listing' and entity_id = ${id}
    order by at desc, id desc limit 100`;
}

// --- Writes -------------------------------------------------------------------

const COLUMN: Record<keyof ListingPatch, string> = {
  modelId: "model_id",
  engineId: "engine_id",
  trimId: "trim_id",
  versionText: "version_text",
  yearFab: "year_fab",
  yearModel: "year_model",
  km: "km",
  priceCents: "price_cents",
  city: "city",
  uf: "uf",
  color: "color",
  transmission: "transmission",
  fuel: "fuel",
  sellerType: "seller_type",
  phone: "contact_phone_e164",
  igUsername: "contact_ig_username",
  summary: "summary_ptbr",
  redFlags: "red_flags",
  options: "options",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function diffPatch(before: ListingPatch, after: ListingPatch) {
  const changes: Partial<Record<keyof ListingPatch, { from: unknown; to: unknown }>> = {};
  for (const key of Object.keys(COLUMN) as (keyof ListingPatch)[]) {
    if (!same(before[key], after[key])) changes[key] = { from: before[key], to: after[key] };
  }
  return changes;
}

export type SaveResult = { ok: true; changed: number } | { ok: false; error: string };

async function audit(
  tx: Tx,
  entry: { actor: string; action: string; id: string; changes: object; note?: string | null },
) {
  await tx`
    insert into public.audit_log (actor, action, entity, entity_id, changes, note)
    values (${entry.actor}, ${entry.action}, 'listing', ${entry.id},
      ${tx.json(entry.changes as postgres.JSONValue)}, ${entry.note ?? null})`;
}

/**
 * Saves the moderator's edits; with `approve`, also publishes. A listing still
 * in moderation gets its slug rebuilt from the corrected data (it was never
 * public); published listings keep their slug so links do not break.
 */
export async function saveListing(
  sql: Sql,
  input: {
    id: string;
    patch: ListingPatch;
    actor: string;
    adminEmail: string;
    approve?: boolean;
  },
): Promise<SaveResult> {
  return sql.begin(async (tx) => {
    const [row] = await tx<(ListingRow & { primary_post: string | null })[]>`
      select ${LISTING_COLUMNS(tx)},
        (select raw_post_id from public.listing_sources ls where ls.listing_id = l.id
          order by is_primary desc, created_at limit 1) as primary_post
      from public.listings l where l.id = ${input.id} for update`;
    if (!row) return { ok: false, error: "Anúncio não encontrado." };
    const { patch } = input;
    if (input.approve && !publishable(patch)) {
      return { ok: false, error: "Para publicar, informe o ano-modelo e o preço ou um contato." };
    }
    const changes: Record<string, { from: unknown; to: unknown }> = diffPatch(toPatch(row), patch);
    const fieldChanges = { ...changes };

    const inModeration = row.status === "pending_review";
    let slug = row.slug;
    if (inModeration) {
      slug = listingSlug(
        {
          modelName: getModel(patch.modelId)!.name,
          engineName: patch.engineId ? getEngine(patch.engineId)?.name : null,
          trimName: patch.trimId ? getTrim(patch.trimId)?.name : null,
          yearModel: patch.yearModel,
          city: patch.city,
          uf: patch.uf,
        },
        row.short_id,
      );
      if (slug !== row.slug) changes.slug = { from: row.slug, to: slug };
    }
    const status = input.approve ? "active" : row.status;
    if (status !== row.status) changes.status = { from: row.status, to: status };
    if (Object.keys(changes).length === 0) return { ok: true, changed: 0 };

    await tx`
      update public.listings set
        model_id = ${patch.modelId}, engine_id = ${patch.engineId}, trim_id = ${patch.trimId},
        version_text = ${patch.versionText}, year_fab = ${patch.yearFab},
        year_model = ${patch.yearModel}, km = ${patch.km}, price_cents = ${patch.priceCents},
        city = ${patch.city}, uf = ${patch.uf}, color = ${patch.color},
        transmission = ${patch.transmission}, fuel = ${patch.fuel},
        seller_type = ${patch.sellerType}, contact_phone_e164 = ${patch.phone},
        contact_ig_username = ${patch.igUsername}, summary_ptbr = ${patch.summary},
        red_flags = ${patch.redFlags}, options = ${patch.options}, slug = ${slug},
        status = ${status}, rejected_at = null,
        review_note = ${input.approve ? null : row.review_note}
      where id = ${row.id}`;
    await audit(tx, {
      actor: input.actor,
      action: input.approve ? "listing.approve" : "listing.update",
      id: row.id,
      changes,
    });
    // What the extraction got wrong, while the listing was still the model's work.
    if (inModeration && row.origin === "instagram") {
      for (const [field, change] of Object.entries(fieldChanges)) {
        await tx`
          insert into public.extraction_corrections
            (listing_id, raw_post_id, field, extracted, corrected, admin_email)
          values (${row.id}, ${row.primary_post}, ${field},
            ${tx.json((change.from ?? null) as postgres.JSONValue)},
            ${tx.json((change.to ?? null) as postgres.JSONValue)}, ${input.adminEmail})`;
      }
    }
    return { ok: true, changed: Object.keys(changes).length };
  });
}

/**
 * Status changes from the admin. Publishing needs the minimum fields;
 * rejecting needs a reason. 'removed' keeps the repost guard of the pipeline
 * (the blocklist screen arrives in 5b).
 */
export async function setListingStatus(
  sql: Sql,
  input: { id: string; status: AdminStatus; actor: string; note?: string | null },
): Promise<SaveResult> {
  if (!ADMIN_STATUSES.includes(input.status)) return { ok: false, error: "Status inválido." };
  const note = input.note?.trim().slice(0, 500) || null;
  if (input.status === "rejected" && !note)
    return { ok: false, error: "Diga o motivo da rejeição." };
  return sql.begin(async (tx) => {
    const [row] = await tx<ListingRow[]>`
      select ${LISTING_COLUMNS(tx)} from public.listings l where l.id = ${input.id} for update`;
    if (!row) return { ok: false, error: "Anúncio não encontrado." };
    if (row.status === input.status) return { ok: true, changed: 0 };
    if (input.status === "active" && !publishable(toPatch(row))) {
      return { ok: false, error: "Para publicar, informe o ano-modelo e o preço ou um contato." };
    }
    await tx`
      update public.listings set
        status = ${input.status},
        sold_at = case when ${input.status} = 'sold' then coalesce(sold_at, now()) else sold_at end,
        removed_at = case when ${input.status} = 'removed' then now() else removed_at end,
        rejected_at = case when ${input.status} = 'rejected' then now() else null end,
        review_note = ${input.status === "rejected" ? note : row.review_note}
      where id = ${row.id}`;
    await audit(tx, {
      actor: input.actor,
      action: input.status === "rejected" ? "listing.reject" : "listing.status",
      id: row.id,
      changes: { status: { from: row.status, to: input.status } },
      note,
    });
    return { ok: true, changed: 1 };
  });
}
