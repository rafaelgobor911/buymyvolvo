/**
 * Page views per listing per day (São Paulo date): a counter, nothing about
 * the visitor. Receives `sql` by parameter.
 */
import type postgres from "postgres";

export async function recordView(sql: postgres.Sql, listingId: string): Promise<void> {
  await sql`
    insert into public.listing_views_daily (listing_id, day, views)
    values (${listingId}, (now() at time zone 'America/Sao_Paulo')::date, 1)
    on conflict (listing_id, day) do update set views = public.listing_views_daily.views + 1`;
}
