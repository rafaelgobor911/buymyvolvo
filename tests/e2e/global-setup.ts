import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";

/**
 * Re-applies the fictitious seed before the suite: admin tests approve and
 * reject demo listings, and each run must start from the same state. Only the
 * seed's own rows are touched (upserts by fixed ids).
 */
const E2E_SELLER = "vendedor.teste@example.com";
const E2E_CLEANUP = `
  delete from public.listing_photos where listing_id::text like '00000000-0000-4000-8000-%';
  delete from public.listing_claims
    where seller_id in (select id from public.sellers where email = '${E2E_SELLER}');
  delete from public.terms_acceptances
    where seller_id in (select id from public.sellers where email = '${E2E_SELLER}');
  delete from public.sellers where email = '${E2E_SELLER}';
  delete from public.blocklist where removal_request_id in (
    select id from public.removal_requests
    where listing_id::text like '00000000-0000-4000-8000-%'
      and id <> '00000000-0000-4000-c000-000000000001');
  delete from public.removal_requests
    where listing_id::text like '00000000-0000-4000-8000-%'
      and id <> '00000000-0000-4000-c000-000000000001';
`;

export default async function globalSetup() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(process.cwd(), file));
    } catch {
      // file not present
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const sql = postgres(url, { max: 1, onnotice: () => {}, prepare: false });
  try {
    // What earlier e2e runs created around the demo listings (test seller, its
    // claims, removal requests); then the seed puts the listings back.
    await sql.unsafe(E2E_CLEANUP);
    await sql.unsafe(readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8"));
  } finally {
    await sql.end();
  }
}
