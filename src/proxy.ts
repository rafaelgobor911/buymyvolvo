/**
 * Runs only on the signed-in areas (admin, seller panel, claim page, OAuth
 * callback): keeps them out of search engines and refreshes the Supabase Auth
 * session cookie (Server Components cannot write cookies). Authorization
 * itself happens in every page and Server Action (requireAdmin,
 * requireSellerUser), never here.
 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
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
    "/admin",
    "/admin/:path*",
    "/vendedor",
    "/vendedor/:path*",
    "/anuncio/:slug/reivindicar",
    "/auth/callback",
  ],
};
