import { parsePublicEnv } from "./schema";

/**
 * Public (browser-safe) configuration. Each NEXT_PUBLIC_* variable must be
 * referenced literally so Next.js can inline it into the client bundle.
 */
export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_NAME: process.env.NEXT_PUBLIC_SITE_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
