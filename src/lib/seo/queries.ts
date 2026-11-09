import "server-only";

import { asAnon } from "@/lib/db/client";
import { type FacetRow, landingCounts, type LandingCount } from "@/lib/seo/landing";

/** Active listings grouped by model, engine, trim and state (public columns only). */
export async function activeFacetRows(): Promise<FacetRow[]> {
  return asAnon(async (tx) => {
    const rows = await tx<
      {
        model_id: string;
        engine_id: string | null;
        trim_id: string | null;
        uf: string | null;
        count: string;
      }[]
    >`
      select l.model_id, l.engine_id, l.trim_id, l.uf, count(*) as count
      from public.listings l
      where l.status = 'active'
      group by 1, 2, 3, 4`;
    return rows.map((r) => ({
      modelId: r.model_id,
      engineId: r.engine_id,
      trimId: r.trim_id,
      uf: r.uf,
      count: Number(r.count),
    }));
  });
}

/** Every landing page with at least one active listing, with its count. */
export async function activeLandingCounts(): Promise<LandingCount[]> {
  return [...landingCounts(await activeFacetRows()).values()];
}

/** Active listings for the sitemap, newest first (well under the 50,000-URL limit). */
export async function sitemapListings(limit = 45_000) {
  return asAnon(async (tx) => {
    const rows = await tx<{ slug: string; last_seen_at: Date }[]>`
      select l.slug, l.last_seen_at from public.listings l
      where l.status = 'active'
      order by l.first_seen_at desc, l.id
      limit ${limit}`;
    return rows.map((r) => ({ slug: r.slug, lastSeenAt: r.last_seen_at }));
  });
}
