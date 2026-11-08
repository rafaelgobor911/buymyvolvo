import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";

/**
 * Re-applies the fictitious seed before the suite: admin tests approve and
 * reject demo listings, and each run must start from the same state. Only the
 * seed's own rows are touched (upserts by fixed ids).
 */
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
    await sql.unsafe(readFileSync(path.join(process.cwd(), "supabase/seed.sql"), "utf8"));
  } finally {
    await sql.end();
  }
}
