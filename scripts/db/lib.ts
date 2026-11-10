/**
 * Database tooling shared by the CLI scripts and the integration-test setup.
 * Never imported by the Next.js app.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";

import { databaseUrlProblem } from "../../src/lib/env/database-url";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");
const BOOTSTRAP_FILE = path.join(ROOT, "supabase/local/bootstrap.sql");
const SEED_FILE = path.join(ROOT, "supabase/seed.sql");
const LOCAL_MARKER = "buymyvolvo-local-bootstrap";

export type Sql = postgres.Sql;

/** Loads .env.local (if present) for scripts run outside Next.js. */
export function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(ROOT, file));
    } catch {
      // file not present
    }
  }
}

export function connect(raw: string | undefined): Sql {
  // A pasted secret often ends with a line break.
  const url = raw?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  const problem = databaseUrlProblem(url);
  if (problem) throw new Error(`DATABASE_URL inválida: ${problem}`);
  return postgres(url, { max: 1, onnotice: () => {}, prepare: false });
}

export function isLocalUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "postgres";
}

async function isLocallyBootstrapped(sql: Sql): Promise<"missing" | "local" | "supabase"> {
  const [row] = await sql<{ exists: boolean; comment: string | null }[]>`
    select exists (select 1 from pg_namespace where nspname = 'auth') as exists,
           obj_description((select oid from pg_namespace where nspname = 'auth'), 'pg_namespace') as comment`;
  if (!row?.exists) return "missing";
  return row.comment === LOCAL_MARKER ? "local" : "supabase";
}

/** Recreates Supabase's roles/schemas on plain Postgres. No-op on a Supabase project. */
export async function bootstrapIfNeeded(sql: Sql, log = console.log) {
  const state = await isLocallyBootstrapped(sql);
  if (state === "supabase") return;
  await sql.unsafe(await readFile(BOOTSTRAP_FILE, "utf8"));
  await sql.unsafe(`comment on schema auth is '${LOCAL_MARKER}'`);
  if (state === "missing") log("• local bootstrap applied (Supabase roles and schemas)");
}

/** Migration files not applied yet (read-only; the table may not exist on a new database). */
export async function pendingMigrations(sql: Sql): Promise<string[]> {
  const [{ exists } = { exists: false }] = await sql<{ exists: boolean }[]>`
    select to_regclass('supabase_migrations.schema_migrations') is not null as exists`;
  const applied = new Set(
    exists
      ? (
          await sql<
            { version: string }[]
          >`select version from supabase_migrations.schema_migrations`
        ).map((r) => r.version)
      : [],
  );
  return (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => !applied.has(f.split("_")[0]!));
}

export async function migrate(sql: Sql, log = console.log): Promise<string[]> {
  await bootstrapIfNeeded(sql, log);
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`);
  const applied = new Set(
    (
      await sql<{ version: string }[]>`select version from supabase_migrations.schema_migrations`
    ).map((r) => r.version),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (!version || applied.has(version)) continue;
    const content = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into supabase_migrations.schema_migrations (version, statements, name)
               values (${version}, ${[content]}, ${rest.join("_")})`;
    });
    log(`• applied ${file}`);
    ran.push(file);
  }
  return ran;
}

export async function seed(sql: Sql, log = console.log) {
  await sql.unsafe(await readFile(SEED_FILE, "utf8"));
  const [row] = await sql<{ count: string }[]>`select count(*)::text as count from public.listings`;
  log(`• seed applied (${row?.count} listings)`);
}

/** Drops everything we created. Refuses to run against non-local databases. */
export async function reset(sql: Sql, url: string, log = console.log) {
  if (!isLocalUrl(url))
    throw new Error(`Refusing to reset a non-local database (${new URL(url).hostname}).`);
  await sql.unsafe(`
    drop schema if exists public cascade;
    drop schema if exists supabase_migrations cascade;
    create schema public;
    grant usage on schema public to public;
    grant create on schema public to current_user;`);
  log("• local database reset");
}
