/**
 * Contact click: GET /r/<listing code> records a lead and redirects (302) to
 * WhatsApp with the pre-filled message, or to Instagram when the post has no
 * phone. The phone only ever appears in this redirect, never in page HTML.
 *
 * Not a click (no lead, no phone): prefetches get 204; bots and link previews
 * go to the listing page. No cookies; IP and user agent are kept only as
 * salted hashes (HASH_SALT).
 */
import type { NextRequest } from "next/server";

import { db } from "@/lib/db/client";
import { requireKeys, serverEnv } from "@/lib/env/server";
import { publicSlugFor, recordClick } from "@/lib/leads/record";
import { clickOrigin, clientIp, isBot, isPrefetch, saltedHash } from "@/lib/leads/request";
import { site } from "@/lib/site";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location, ...NO_STORE } });

export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const headers = request.headers;
  if (isPrefetch(headers)) return new Response(null, { status: 204, headers: NO_STORE });

  const sql = db();
  const userAgent = headers.get("user-agent");
  if (isBot(userAgent)) {
    const slug = await publicSlugFor(sql, code);
    return redirect(slug ? `/anuncio/${slug}` : "/busca");
  }

  const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
  const result = await recordClick(sql, {
    shortId: code,
    ipHash: saltedHash(HASH_SALT, clientIp(headers)),
    uaHash: saltedHash(HASH_SALT, userAgent),
    origin: clickOrigin(request.url, headers.get("referer")),
    site: { name: site.name, url: site.url },
  });
  switch (result.kind) {
    case "not_found":
      return redirect("/busca");
    case "listing":
      return redirect(`/anuncio/${result.slug}`);
    case "contact":
      return redirect(result.fictitious ? `/r/previa/${result.refCode}` : result.url);
  }
}

/** Link checkers send HEAD: answer without recording or revealing anything. */
export function HEAD() {
  return new Response(null, { status: 204, headers: NO_STORE });
}
