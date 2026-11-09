import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * Contact clicks (/r/), short links (/a/), the API and the logged-in areas are
 * never pages to index. /busca stays crawlable (noindex, follow) so its links
 * reach the listings.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/r/", "/a/", "/api/", "/admin", "/vendedor", "/auth/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
