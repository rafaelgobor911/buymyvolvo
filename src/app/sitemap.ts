import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { isIndexable } from "@/lib/seo/landing";
import { activeLandingCounts, sitemapListings } from "@/lib/seo/queries";
import { absoluteUrl } from "@/lib/site";

/**
 * Home, the landing pages with enough active listings and every active
 * listing. Out: search results (/busca) and the legal drafts, all noindex
 * (add /termos, /privacidade and /termos-do-anunciante after the lawyer's review).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [landings, listings] = await Promise.all([activeLandingCounts(), sitemapListings()]);
  const fixed: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/volvo"), changeFrequency: "daily", priority: 0.9 },
  ];
  return [
    ...fixed,
    ...landings
      .filter(isIndexable)
      .sort((a, b) => a.depth - b.depth || b.count - a.count || a.path.localeCompare(b.path))
      .map((l) => ({
        url: absoluteUrl(l.path),
        changeFrequency: "daily" as const,
        priority: l.depth === 1 ? 0.8 : l.depth === 2 ? 0.6 : 0.5,
      })),
    ...listings.map((l) => ({
      url: absoluteUrl(`/anuncio/${l.slug}`),
      lastModified: l.lastSeenAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
