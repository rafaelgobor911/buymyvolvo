import "server-only";

import postgres from "postgres";

import { requireKeys, serverEnv } from "@/lib/env/server";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

const globalForDb = globalThis as unknown as { __db?: Sql };

/**
 * Server-side Postgres pool. `prepare: false` keeps it compatible with
 * Supabase's transaction pooler. Cached on globalThis so dev reloads reuse it.
 */
export function db(): Sql {
  globalForDb.__db ??= postgres(requireKeys(serverEnv(), ["DATABASE_URL"]).DATABASE_URL, {
    max: 5,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return globalForDb.__db;
}

/**
 * Runs queries as the `anon` role, so Row Level Security and column grants
 * apply exactly as they would for an anonymous visitor. Use for every public read.
 */
export async function asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await db().begin(async (tx) => {
    await tx`set local role anon`;
    return fn(tx);
  })) as T;
}
