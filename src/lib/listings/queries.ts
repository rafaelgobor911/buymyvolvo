import "server-only";

import { asAnon, type Tx } from "@/lib/db/client";
import { PAGE_SIZE, type SearchFilters } from "@/lib/search/filters";
import type { Fuel, SellerType, Transmission } from "@/lib/taxonomy";

export type ListingStatus = "active" | "sold" | "expired";

export interface ListingCard {
  id: string;
  slug: string;
  status: ListingStatus;
  origin: "instagram" | "direct";
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
  sourcePermalink: string | null;
  sourceUsername: string | null;
}

// Explicit columns only: anon has column-level grants (no phone, no internal fields).
const CARD_COLUMNS = (tx: Tx) => tx`
  l.id, l.slug, l.status, l.origin, l.model_id, m.name as model_name, e.name as engine_name,
  t.name as trim_name, l.version_text, l.year_fab, l.year_model, l.km, l.price_cents, l.city, l.uf,
  l.fuel, l.transmission, l.seller_type, l.is_claimed, l.is_featured, l.first_seen_at`;

const JOINS = (tx: Tx) => tx`
  from public.listings l
  join public.vehicle_models m on m.id = l.model_id
  left join public.vehicle_engines e on e.id = l.engine_id
  left join public.vehicle_trims t on t.id = l.trim_id`;

type CardRow = {
  id: string;
  slug: string;
  status: ListingStatus;
  origin: "instagram" | "direct";
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
});

export interface SearchResult {
  items: ListingCard[];
  total: number;
  page: number;
  pageCount: number;
}

export async function searchListings(f: SearchFilters): Promise<SearchResult> {
  return asAnon(async (tx) => {
    const conditions = [tx`l.status = 'active'`];
    if (f.modelIds.length) conditions.push(tx`l.model_id = any(${f.modelIds})`);
    if (f.engineIds.length) conditions.push(tx`l.engine_id = any(${f.engineIds})`);
    if (f.trimIds.length) conditions.push(tx`l.trim_id = any(${f.trimIds})`);
    if (f.fuels.length) conditions.push(tx`l.fuel = any(${f.fuels})`);
    if (f.transmission) conditions.push(tx`l.transmission = ${f.transmission}`);
    if (f.sellerType) conditions.push(tx`l.seller_type = ${f.sellerType}`);
    if (f.yearMin !== undefined) conditions.push(tx`l.year_model >= ${f.yearMin}`);
    if (f.yearMax !== undefined) conditions.push(tx`l.year_model <= ${f.yearMax}`);
    if (f.priceMin !== undefined) conditions.push(tx`l.price_cents >= ${f.priceMin * 100}`);
    if (f.priceMax !== undefined) conditions.push(tx`l.price_cents <= ${f.priceMax * 100}`);
    if (f.kmMax !== undefined) conditions.push(tx`l.km <= ${f.kmMax}`);
    if (f.uf) conditions.push(tx`l.uf = ${f.uf}`);
    if (f.city)
      conditions.push(tx`public.normalize_text(l.city) = public.normalize_text(${f.city})`);
    if (f.text) {
      // Full-text (Portuguese stemming, accent-insensitive) OR trigram word similarity (typos).
      conditions.push(tx`(
        l.search_vector @@ websearch_to_tsquery('public.pt_unaccent', ${f.text})
        or l.search_text operator(extensions.%>) public.normalize_text(${f.text})
      )`);
    }
    const where = conditions.reduce((acc, c) => tx`${acc} and ${c}`);

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

export async function getListingBySlug(slug: string): Promise<ListingDetail | null> {
  if (!/^[a-z0-9-]{3,200}$/.test(slug)) return null;
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
        source_permalink: string | null;
        source_username: string | null;
      })[]
    >`
      select ${CARD_COLUMNS(tx)}, l.engine_id, l.trim_id, l.color, l.options, l.summary_ptbr,
        l.last_seen_at, l.expires_at, l.sold_at, l.contact_ig_username,
        s.display_name as seller_name, src.permalink as source_permalink, src.ig_username as source_username
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
    return {
      ...toCard(row),
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
      sourcePermalink: row.source_permalink,
      sourceUsername: row.source_username,
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
