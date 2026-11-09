/**
 * Usage: tsx scripts/db/cli.ts <generate|status|migrate|seed|reset|setup>
 *   generate  write the taxonomy migration and supabase/seed.sql from TypeScript
 *   status    list pending migrations without applying them
 *   migrate   apply pending migrations (bootstraps Supabase roles on plain Postgres)
 *   seed      load fictitious listings (local databases only)
 *   reset     LOCAL ONLY: drop everything, migrate and seed
 *   setup     migrate + seed
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { connect, isLocalUrl, loadLocalEnv, migrate, pendingMigrations, reset, seed } from "./lib";
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
  // The fictitious listings never go to a real database (production, previews).
  if ((command === "seed" || command === "setup") && url && !isLocalUrl(url)) {
    throw new Error(`Refusing to load fictitious listings into ${new URL(url).hostname}.`);
  }
  const sql = connect(url);
  try {
    switch (command) {
      case "status": {
        const pending = await pendingMigrations(sql);
        console.log(
          pending.length
            ? `${pending.length} pending:\n${pending.map((f) => `• ${f}`).join("\n")}`
            : "• no pending migrations",
        );
        break;
      }
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
        throw new Error(
          `Unknown command "${command}". Use generate|status|migrate|seed|reset|setup.`,
        );
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
