import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env/public";

/** Google login goes through Supabase Auth; until the project exists, only the test login works. */
export const supabaseConfigured = () =>
  !!publicEnv.NEXT_PUBLIC_SUPABASE_URL && !!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** A new client per request (the library's cookie and cache-header handling requires it). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {}
        },
      },
    },
  );
}
