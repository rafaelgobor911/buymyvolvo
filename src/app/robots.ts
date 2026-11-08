import type { MetadataRoute } from "next";

/** Contact clicks (/r/) and short links (/a/) are redirects, never pages to index. The sitemap arrives in Phase 7. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/r/", "/a/", "/api/"] },
  };
}
