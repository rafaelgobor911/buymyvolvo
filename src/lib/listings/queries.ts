import "server-only";

import { asAnon, db, type Tx } from "@/lib/db/client";
import { PAGE_SIZE, type SearchFilters } from "@/lib/search/filters";
import { readBmvNumbers } from "@/lib/authorization/messages";
import { photoUrl } from "@/lib/photos/storage";
import {
  BODY_TYPES,
  type BodyType,
  bodyTypeMatches,
  type Fuel,
  type SellerType,
  type Transmission,
} from "@/lib/taxonomy";

export type ListingStatus = "active" | "sold" | "expired";

/** Alerts shown to buyers, in display order; "sem_contato" stays internal. */
export const PUBLIC_ALERTS = [
  "repasse",
  "agio",
  "pedido_de_sinal",
  "leilao",
  "sinistro",
  "documento_pendente",
  "abaixo_do_mercado",
] as const;
export type PublicAlert = (typeof PUBLIC_ALERTS)[number];

const publicAlerts = (flags: string[] | null): PublicAlert[] =>
  PUBLIC_ALERTS.filter((a) => flags?.includes(a));

export interface ListingCard {
  id: string;
  slug: string;
  status: ListingStatus;
  origin: "instagram" | "direct" | "admin";
  modelId: string;
  modelName: string;
  engineName: string | null;
  trimName: string | null;
  versionText: string | null;
  yearFab: number | null;
  yearModel: number | null;
  km: number | null;
  priceCents: number | null;
  city: string | null;
  uf: string | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  sellerType: SellerType;
  isClaimed: boolean;
  isFeatured: boolean;
  firstSeenAt: Date;
  /** Alerts the post itself declares (repasse, ágio, leilão...); internal flags removed. */
  alerts: PublicAlert[];
  /** First photo of a claimed listing (seller's licensed photos), small size. */
  coverUrl: string | null;
}

export interface ListingPhoto {
  url: string;
  urlSmall: string;
  width: number | null;
  height: number | null;
}

export interface ListingDetail extends ListingCard {
  engineId: string | null;
  trimId: string | null;
  color: string | null;
  options: string[];
  summary: string | null;
  sellerName: string | null;
  lastSeenAt: Date;
  expiresAt: Date | null;
  soldAt: Date | null;
  instagramUsername: string | null;
  /** Code used by /r/<code> (contact click) and /a/<code> (short link). */
  shortId: string;
  /** Whether the WhatsApp button applies; the number itself stays server-side. */
  hasPhone: boolean;
  sourcePermalink: string | null;
  sourceUsername: string | null;
  /** Active, backed only by hashtag posts (never re-read) older than the configured days. */
  possiblyUnavailable: boolean;
  /** The seller's own description (claimed listings), shown instead of the automatic summary. */
  sellerDescription: string | null;
  /** Only the state is known, inferred from the phone's area code. */
  ufFromDdd: boolean;
  /** The seller's licensed photos, in order (claimed listings only). */
  photos: ListingPhoto[];
}

// Explicit columns only: anon has column-level grants (no phone, no internal fields).
const CARD_COLUMNS = (tx: Tx) => tx`
  l.id, l.slug, l.status, l.origin, l.model_id, m.name as model_name, e.name as engine_name,
  t.name as trim_name, l.version_text, l.year_fab, l.year_model, l.km, l.price_cents, l.city, l.uf,
  l.fuel, l.transmission, l.seller_type, l.is_claimed, l.is_featured, l.first_seen_at, l.red_flags,
  (select p.storage_path from public.listing_photos p where p.listing_id = l.id
    order by p.position, p.id limit 1) as cover_path`;

const JOINS = (tx: Tx) => tx`
  from public.listings l
  join public.vehicle_models m on m.id = l.model_id
  left join public.vehicle_engines e on e.id = l.engine_id
  left join public.vehicle_trims t on t.id = l.trim_id`;

type CardRow = {
  id: string;
  slug: string;
  status: ListingStatus;
  origin: "instagram" | "direct" | "admin";
  model_id: string;
  model_name: string;
  engine_name: string | null;
  trim_name: string | null;
  version_text: string | null;
  year_fab: number | null;
  year_model: number | null;
  km: number | null;
  price_cents: string | null;
  city: string | null;
  uf: string | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  seller_type: SellerType;
  is_claimed: boolean;
  is_featured: boolean;
  first_seen_at: Date;
  red_flags: string[] | null;
  cover_path: string | null;
};

const toCard = (r: CardRow): ListingCard => ({
  id: r.id,
  slug: r.slug,
  status: r.status,
  origin: r.origin,
  modelId: r.model_id,
  modelName: r.model_name,
  engineName: r.engine_name,
  trimName: r.trim_name,
  versionText: r.version_text,
  yearFab: r.year_fab,
  yearModel: r.year_model,
  km: r.km,
  priceCents: r.price_cents === null ? null : Number(r.price_cents),
  city: r.city,
  uf: r.uf,
  fuel: r.fuel,
  transmission: r.transmission,
  sellerType: r.seller_type,
  isClaimed: r.is_claimed,
  isFeatured: r.is_featured,
  firstSeenAt: r.first_seen_at,
  alerts: publicAlerts(r.red_flags),
  coverUrl: r.cover_path ? photoUrl(r.cover_path, 640) : null,
});

export interface SearchResult {
  items: ListingCard[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Listings of a body type: whole models, plus model-year windows for models
 * sold with several bodies (V40 perua 1996–2004, hatch 2013–2019).
 */
function bodyCondition(tx: Tx, body: BodyType) {
  const matches = bodyTypeMatches(body);
  const whole = matches.filter((m) => m.yearMin === undefined).map((m) => m.modelId);
  const parts = [tx`l.model_id = any(${whole})`];
  for (const m of matches.filter((x) => x.yearMin !== undefined)) {
    parts.push(
      m.yearMax === undefined
        ? tx`(l.model_id = ${m.modelId} and l.year_model >= ${m.yearMin!})`
        : tx`(l.model_id = ${m.modelId} and l.year_model between ${m.yearMin!} and ${m.yearMax})`,
    );
  }
  return tx`(${parts.reduce((acc, p) => tx`${acc} or ${p}`)})`;
}

/** WHERE clause of the public search (active listings matching the filters). */
function searchWhere(tx: Tx, f: SearchFilters) {
  const conditions = [tx`l.status = 'active'`];
  if (f.modelIds.length) conditions.push(tx`l.model_id = any(${f.modelIds})`);
  if (f.engineIds.length) conditions.push(tx`l.engine_id = any(${f.engineIds})`);
  if (f.trimIds.length) conditions.push(tx`l.trim_id = any(${f.trimIds})`);
  if (f.fuels.length) conditions.push(tx`l.fuel = any(${f.fuels})`);
  if (f.transmission) conditions.push(tx`l.transmission = ${f.transmission}`);
  if (f.sellerType) conditions.push(tx`l.seller_type = ${f.sellerType}`);
  if (f.repasse === "only") conditions.push(tx`l.red_flags @> array['repasse']`);
  if (f.repasse === "exclude") conditions.push(tx`not (l.red_flags @> array['repasse'])`);
  if (f.bodyType) conditions.push(bodyCondition(tx, f.bodyType));
  if (f.yearMin !== undefined) conditions.push(tx`l.year_model >= ${f.yearMin}`);
  if (f.yearMax !== undefined) conditions.push(tx`l.year_model <= ${f.yearMax}`);
  if (f.priceMin !== undefined) conditions.push(tx`l.price_cents >= ${f.priceMin * 100}`);
  if (f.priceMax !== undefined) conditions.push(tx`l.price_cents <= ${f.priceMax * 100}`);
  if (f.kmMax !== undefined) conditions.push(tx`l.km <= ${f.kmMax}`);
  if (f.uf) conditions.push(tx`l.uf = ${f.uf}`);
  if (f.city) conditions.push(tx`public.normalize_text(l.city) = public.normalize_text(${f.city})`);
  if (f.text) {
    // Full-text (Portuguese stemming, accent-insensitive) OR trigram word similarity (typos).
    conditions.push(tx`(
      l.search_vector @@ websearch_to_tsquery('public.pt_unaccent', ${f.text})
      or l.search_text operator(extensions.%>) public.normalize_text(${f.text})
    )`);
  }
  return conditions.reduce((acc, c) => tx`${acc} and ${c}`);
}

export async function searchListings(f: SearchFilters): Promise<SearchResult> {
  return asAnon(async (tx) => {
    const where = searchWhere(tx, f);

    const order =
      f.sort === "menor-preco"
        ? tx`l.price_cents asc nulls last, l.first_seen_at desc`
        : f.sort === "menor-km"
          ? tx`l.km asc nulls last, l.first_seen_at desc`
          : tx`l.is_featured desc, l.first_seen_at desc`;

    const offset = (f.page - 1) * PAGE_SIZE;
    const rows = await tx<(CardRow & { total: string })[]>`
      select ${CARD_COLUMNS(tx)}, count(*) over () as total
      ${JOINS(tx)}
      where ${where}
      order by ${order}, l.id
      limit ${PAGE_SIZE} offset ${offset}`;

    let total = rows[0] ? Number(rows[0].total) : 0;
    if (rows.length === 0 && offset > 0) {
      const [row] = await tx<
        { total: string }[]
      >`select count(*) as total ${JOINS(tx)} where ${where}`;
      total = Number(row?.total ?? 0);
    }
    return {
      items: rows.map(toCard),
      total,
      page: f.page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  });
}

export async function getRecentListings(limit = 8): Promise<ListingCard[]> {
  return asAnon(async (tx) => {
    const rows = await tx<CardRow[]>`
      select ${CARD_COLUMNS(tx)} ${JOINS(tx)}
      where l.status = 'active'
      order by l.first_seen_at desc, l.id
      limit ${limit}`;
    return rows.map(toCard);
  });
}

/** Active listings per body type (home "Explore por tipo e modelo"); bodies with none are left out. */
export async function bodyTypeCounts(): Promise<Array<{ bodyType: BodyType; count: number }>> {
  return asAnon(async (tx) => {
    const out: Array<{ bodyType: BodyType; count: number }> = [];
    for (const bodyType of BODY_TYPES) {
      const [row] = await tx<Array<{ count: number }>>`
        select count(*)::int as count from public.listings l
        where l.status = 'active' and ${bodyCondition(tx, bodyType)}`;
      if (row && row.count > 0) out.push({ bodyType, count: row.count });
    }
    return out;
  });
}

/** Operational setting (not user data), read with the server role and never exposed. */
async function hashtagStaleAfterDays(): Promise<number> {
  const [row] = await db()<{ value: unknown }[]>`
    select value from public.app_settings where key = 'hashtag_stale_after_days'`;
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

export async function getListingBySlug(slug: string): Promise<ListingDetail | null> {
  if (!/^[a-z0-9-]{3,200}$/.test(slug)) return null;
  const staleDays = await hashtagStaleAfterDays();
  return asAnon(async (tx) => {
    const [row] = await tx<
      (CardRow & {
        engine_id: string | null;
        trim_id: string | null;
        color: string | null;
        options: string[];
        summary_ptbr: string | null;
        seller_name: string | null;
        last_seen_at: Date;
        expires_at: Date | null;
        sold_at: Date | null;
        contact_ig_username: string | null;
        short_id: string;
        has_phone: boolean;
        source_permalink: string | null;
        source_username: string | null;
        possibly_unavailable: boolean;
        seller_description: string | null;
        uf_from_ddd: boolean;
      })[]
    >`
      select ${CARD_COLUMNS(tx)}, l.engine_id, l.trim_id, l.color, l.options, l.summary_ptbr,
        l.last_seen_at, l.expires_at, l.sold_at, l.contact_ig_username, l.short_id, l.has_phone,
        l.seller_description, l.uf_from_ddd,
        s.display_name as seller_name, src.permalink as source_permalink, src.ig_username as source_username,
        (l.status = 'active' and l.origin = 'instagram'
          and l.first_seen_at < now() - make_interval(days => ${staleDays})
          and exists (select 1 from public.listing_sources x where x.listing_id = l.id)
          and not exists (
            select 1 from public.listing_sources x
            join public.raw_posts rp on rp.id = x.raw_post_id
            where x.listing_id = l.id and rp.ig_username is not null)
        ) as possibly_unavailable
      ${JOINS(tx)}
      left join public.sellers s on s.id = l.seller_id
      left join lateral (
        select rp.permalink, rp.ig_username
        from public.listing_sources ls
        join public.raw_posts rp on rp.id = ls.raw_post_id
        where ls.listing_id = l.id
        order by ls.is_primary desc, ls.created_at
        limit 1
      ) src on true
      where l.slug = ${slug}`;
    if (!row) return null;
    const photoRows = await tx<
      { storage_path: string; width: number | null; height: number | null }[]
    >`
      select storage_path, width, height from public.listing_photos
      where listing_id = ${row.id} order by position, id`;
    const photos = photoRows.flatMap((p) => {
      const url = photoUrl(p.storage_path, 1600);
      const urlSmall = photoUrl(p.storage_path, 640);
      return url && urlSmall ? [{ url, urlSmall, width: p.width, height: p.height }] : [];
    });
    return {
      ...toCard(row),
      sellerDescription: row.seller_description,
      ufFromDdd: row.uf_from_ddd,
      photos,
      engineId: row.engine_id,
      trimId: row.trim_id,
      color: row.color,
      options: row.options,
      summary: row.summary_ptbr,
      sellerName: row.seller_name,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      soldAt: row.sold_at,
      instagramUsername: row.contact_ig_username,
      shortId: row.short_id,
      hasPhone: row.has_phone,
      sourcePermalink: row.source_permalink,
      sourceUsername: row.source_username,
      possiblyUnavailable: row.possibly_unavailable,
    };
  });
}

/** Active listings of the same model, for "veja também" and empty states. */
export async function getSimilarListings(modelId: string, excludeId: string, limit = 4) {
  return asAnon(async (tx) => {
    const rows = await tx<CardRow[]>`
      select ${CARD_COLUMNS(tx)} ${JOINS(tx)}
      where l.status = 'active' and l.model_id = ${modelId} and l.id <> ${excludeId}
      order by l.first_seen_at desc
      limit ${limit}`;
    return rows.map(toCard);
  });
}

export interface SearchStats {
  total: number;
  /** Listings with a price, repasses left out (their prices are not comparable). */
  priced: number;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  priceMedianCents: number | null;
  yearMin: number | null;
  yearMax: number | null;
}

/**
 * Counts and the asking-price range of the active listings matching the
 * filters. Only our own data (asking prices), never a market reference.
 */
export async function searchStats(f: SearchFilters): Promise<SearchStats> {
  return asAnon(async (tx) => {
    const priced = tx`l.price_cents is not null and not (l.red_flags @> array['repasse'])`;
    const [row] = await tx<
      {
        total: string;
        priced: string;
        price_min: string | null;
        price_max: string | null;
        price_median: string | null;
        year_min: number | null;
        year_max: number | null;
      }[]
    >`
      select count(*) as total,
        count(*) filter (where ${priced}) as priced,
        min(l.price_cents) filter (where ${priced}) as price_min,
        max(l.price_cents) filter (where ${priced}) as price_max,
        percentile_disc(0.5) within group (order by l.price_cents)
          filter (where ${priced}) as price_median,
        min(l.year_model) as year_min, max(l.year_model) as year_max
      from public.listings l
      where ${searchWhere(tx, f)}`;
    const num = (v: string | null | undefined) =>
      v === null || v === undefined ? null : Number(v);
    return {
      total: Number(row?.total ?? 0),
      priced: Number(row?.priced ?? 0),
      priceMinCents: num(row?.price_min),
      priceMaxCents: num(row?.price_max),
      priceMedianCents: num(row?.price_median),
      yearMin: row?.year_min ?? null,
      yearMax: row?.year_max ?? null,
    };
  });
}

/**
 * Whether the contact button can work: Buy My Volvo's WhatsApp number is set
 * (Configurações). Only a yes/no reaches the page, never the number.
 */
export async function contactAvailable(): Promise<boolean> {
  const [row] = await db()<{ value: unknown }[]>`
    select value from public.app_settings where key = 'bmv_whatsapp_numbers'`;
  return readBmvNumbers(row?.value).length > 0;
}
