/**
 * Lead reports for the admin: by day, by listing (with views and click rate)
 * and by seller, plus the CSV export. Days follow São Paulo time. Receives
 * `sql` by parameter.
 */
import type postgres from "postgres";

type Sql = postgres.Sql;

const SP = "America/Sao_Paulo";

export interface DayRow {
  day: string;
  leads: number;
  clicks: number;
  views: number;
}

export async function leadsByDay(sql: Sql, days: number): Promise<DayRow[]> {
  return sql<DayRow[]>`
    with span as (
      select generate_series(
        (now() at time zone ${SP})::date - (${days}::int - 1),
        (now() at time zone ${SP})::date, interval '1 day')::date as day
    )
    select to_char(span.day, 'YYYY-MM-DD') as day,
      coalesce(l.leads, 0)::int as leads, coalesce(l.clicks, 0)::int as clicks,
      coalesce(v.views, 0)::int as views
    from span
    left join (
      select (created_at at time zone ${SP})::date as day, count(*) as leads, sum(click_count) as clicks
      from public.leads group by 1
    ) l on l.day = span.day
    left join (
      select day, sum(views) as views from public.listing_views_daily group by day
    ) v on v.day = span.day
    order by span.day desc`;
}

export interface ListingLeadRow {
  id: string;
  shortId: string;
  title: string;
  status: string;
  views: number;
  leads: number;
  clicks: number;
  /** Leads per view, or null without views. */
  rate: number | null;
}

/** Listings with contacts or views in the period, most contacted first. */
export async function leadsByListing(
  sql: Sql,
  days: number,
  limit = 50,
): Promise<ListingLeadRow[]> {
  const rows = await sql<Omit<ListingLeadRow, "rate">[]>`
    with since as (select (now() at time zone ${SP})::date - (${days}::int - 1) as day),
    l as (
      select listing_id, count(*)::int as leads, sum(click_count)::int as clicks
      from public.leads, since where (created_at at time zone ${SP})::date >= since.day
      group by listing_id
    ),
    v as (
      select listing_id, sum(views)::int as views
      from public.listing_views_daily, since where listing_views_daily.day >= since.day
      group by listing_id
    )
    select x.id, x.short_id as "shortId",
      concat_ws(' ', m.name, e.name, t.name, x.year_model::text) as title, x.status,
      coalesce(v.views, 0) as views, coalesce(l.leads, 0) as leads, coalesce(l.clicks, 0) as clicks
    from public.listings x
    join public.vehicle_models m on m.id = x.model_id
    left join public.vehicle_engines e on e.id = x.engine_id
    left join public.vehicle_trims t on t.id = x.trim_id
    left join l on l.listing_id = x.id
    left join v on v.listing_id = x.id
    where l.listing_id is not null or v.listing_id is not null
    order by coalesce(l.leads, 0) desc, coalesce(v.views, 0) desc, x.id
    limit ${limit}`;
  return rows.map((r) => ({ ...r, rate: r.views > 0 ? r.leads / r.views : null }));
}

export interface SellerLeadRow {
  sellerId: string | null;
  name: string;
  listings: number;
  leads: number;
  clicks: number;
}

export async function leadsBySeller(sql: Sql, days: number): Promise<SellerLeadRow[]> {
  return sql<SellerLeadRow[]>`
    select s.id as "sellerId", coalesce(s.display_name, 'Anúncios não reivindicados') as name,
      count(distinct ld.listing_id)::int as listings, count(*)::int as leads,
      sum(ld.click_count)::int as clicks
    from public.leads ld
    join public.listings l on l.id = ld.listing_id
    left join public.sellers s on s.id = l.seller_id
    where (ld.created_at at time zone ${SP})::date >= (now() at time zone ${SP})::date - (${days}::int - 1)
    group by s.id, s.display_name
    order by leads desc`;
}

const csvCell = (value: unknown) => {
  const s = value === null || value === undefined ? "" : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV of the period's leads (";"-separated with a BOM, so Excel in Portuguese
 * opens it with accents and columns right). No IP or user agent hash.
 */
export async function leadsCsv(sql: Sql, days: number): Promise<string> {
  const rows = await sql<Record<string, unknown>[]>`
    select to_char(ld.created_at at time zone ${SP}, 'YYYY-MM-DD HH24:MI') as data_hora,
      ld.ref_code as codigo, ld.channel as canal, ld.click_count as cliques,
      l.short_id as anuncio_codigo,
      concat_ws(' ', m.name, e.name, t.name, l.year_model::text) as anuncio,
      coalesce(s.display_name, '') as vendedor, coalesce(ld.referrer, '') as origem,
      coalesce(ld.utm_source, '') as utm_source, coalesce(ld.utm_medium, '') as utm_medium,
      coalesce(ld.utm_campaign, '') as utm_campaign, ld.outcome as resultado
    from public.leads ld
    join public.listings l on l.id = ld.listing_id
    join public.vehicle_models m on m.id = l.model_id
    left join public.vehicle_engines e on e.id = l.engine_id
    left join public.vehicle_trims t on t.id = l.trim_id
    left join public.sellers s on s.id = l.seller_id
    where (ld.created_at at time zone ${SP})::date >= (now() at time zone ${SP})::date - (${days}::int - 1)
    order by ld.created_at desc`;
  const header = [
    "data_hora",
    "codigo",
    "canal",
    "cliques",
    "anuncio_codigo",
    "anuncio",
    "vendedor",
    "origem",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "resultado",
  ];
  const lines = [header.join(";"), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(";"))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const REPORT_DAYS = [7, 30, 90] as const;
export const reportDays = (raw: unknown): number => {
  const n = Number(raw);
  return (REPORT_DAYS as readonly number[]).includes(n) ? n : 30;
};
