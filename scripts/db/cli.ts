/**
 * Usage: tsx scripts/db/cli.ts <generate|migrate|seed|reset|setup>
 *   generate  write the taxonomy migration and supabase/seed.sql from TypeScript
 *   migrate   apply pending migrations (bootstraps Supabase roles on plain Postgres)
 *   seed      load fictitious listings (dev only)
 *   reset     LOCAL ONLY: drop everything, migrate and seed
 *   setup     migrate + seed
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { connect, loadLocalEnv, migrate, reset, seed } from "./lib";
import { generateSeedSql, generateTaxonomySql, SEED_FILE, TAXONOMY_MIGRATION } from "./sql-gen";

const ROOT = path.resolve(import.meta.dirname, "../..");

async function main() {
  const command = process.argv[2];
  if (command === "generate") {
    await writeFile(path.join(ROOT, TAXONOMY_MIGRATION), generateTaxonomySql());
    await writeFile(path.join(ROOT, SEED_FILE), generateSeedSql());
    console.log(`• wrote ${TAXONOMY_MIGRATION}\n• wrote ${SEED_FILE}`);
    return;
  }

  loadLocalEnv();
  const url = process.env.DATABASE_URL;
  const sql = connect(url);
  try {
    switch (command) {
      case "migrate":
        await migrate(sql);
        break;
      case "seed":
        await seed(sql);
        break;
      case "setup":
        await migrate(sql);
        await seed(sql);
        break;
      case "reset":
        await reset(sql, url!);
        await migrate(sql);
        await seed(sql);
        break;
      default:
        throw new Error(`Unknown command "${command}". Use generate|migrate|seed|reset|setup.`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
