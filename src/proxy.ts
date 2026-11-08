/**
 * Runs only on /admin: keeps the admin out of search engines and refreshes
 * the Supabase Auth session cookie (Server Components cannot write cookies).
 * Authorization itself happens in every admin page and Server Action
 * (requireAdmin), never here.
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
    await supabase.auth.getUser();
  }
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
