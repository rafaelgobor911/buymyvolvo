/**
 * Two jobs, by path:
 *
 * - Landing pages (/volvo/...): real 308 (uppercase → lowercase) and 404 for
 *   paths that are not a model/version/state. The page streams, so it could
 *   only answer 200 by then. Pure check, no database.
 * - Signed-in areas (admin, seller panel, claim page, OAuth callback): keeps
 *   them out of search engines and refreshes the Supabase Auth session cookie
 *   (Server Components cannot write cookies). Authorization itself happens in
 *   every page and Server Action (requireAdmin, requireSellerUser), never here.
 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { LANDING_ROOT, resolveLanding } from "@/lib/seo/landing";

function landingResponse(request: NextRequest) {
  const segments = request.nextUrl.pathname
    .slice(LANDING_ROOT.length + 1)
    .split("/")
    .filter(Boolean);
  const resolved = resolveLanding(segments);
  if (resolved.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = resolved.path;
    return NextResponse.redirect(url, 308);
  }
  if (resolved.kind === "not_found") {
    // A path with no route renders the not-found page with a 404 status.
    return NextResponse.rewrite(new URL("/_sem-pagina", request.url), { status: 404 });
  }
  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(`${LANDING_ROOT}/`)) return landingResponse(request);
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [header, value] of Object.entries(headers))
            response.headers.set(header, value);
        },
      },
    });
    // Validates the session with the Auth server and refreshes expired tokens.
    try {
      await supabase.auth.getUser();
    } catch {
      // Auth server unreachable: pages treat the visitor as signed out.
    }
  }
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    "/volvo/:path+",
    "/admin",
    "/admin/:path*",
    "/vendedor",
    "/vendedor/:path*",
    "/anuncio/:slug/reivindicar",
    "/auth/callback",
  ],
};
