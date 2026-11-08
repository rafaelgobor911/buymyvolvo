/**
 * Runs a job with a lease lock (job_locks) and a job_runs record.
 *
 * - The lock is a row with an expiry, which works through Supabase's
 *   transaction pooler (advisory locks do not). A run that finds the lock
 *   taken is recorded as "skipped".
 * - Dry run: every write goes through ctx.write(), which rolls the
 *   transaction back at the end, so a dry run executes exactly the same code
 *   (API calls included) and leaves only its job_runs row behind.
 */
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import type postgres from "postgres";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

export interface JobContext {
  sql: Sql;
  dryRun: boolean;
  now: Date;
  log: (message: string) => void;
  /** Runs `fn` in a transaction; in a dry run the transaction is rolled back. */
  write<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface JobResult {
  stats: Record<string, unknown>;
  /** "skipped": nothing to do (no due sources, not configured…). */
  status?: "succeeded" | "skipped";
  /** Something an admin must look at (token expiring, budget exhausted…). */
  alerts?: string[];
  tokensIn?: number;
  tokensOut?: number;
  aiCostUsd?: number;
}

export interface JobRun {
  id: string | null;
  job: string;
  status: "succeeded" | "failed" | "skipped";
  dryRun: boolean;
  durationMs: number;
  stats: Record<string, unknown>;
  alerts: string[];
  error?: string;
}

const ROLLBACK = Symbol("dry-run rollback");

function writer(sql: Sql, dryRun: boolean): JobContext["write"] {
  return async <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => {
    if (!dryRun) return (await sql.begin((tx) => fn(tx))) as T;
    let result: T | undefined;
    try {
      await sql.begin(async (tx) => {
        result = await fn(tx);
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
    return result as T;
  };
}

async function acquireLock(sql: Sql, job: string, owner: string, seconds: number) {
  const rows = await sql`
    insert into public.job_locks (job_name, locked_until, locked_by)
    values (${job}, now() + make_interval(secs => ${seconds}), ${owner})
    on conflict (job_name) do update
      set locked_until = excluded.locked_until, locked_by = excluded.locked_by
      where public.job_locks.locked_until < now()
    returning job_name`;
  return rows.length > 0;
}

const message = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 1000);

export interface RunOptions {
  dryRun?: boolean;
  /** Lock lease; should exceed the job's worst-case duration. */
  lockSeconds?: number;
  now?: Date;
  log?: (message: string) => void;
}

export async function runJob(
  sql: Sql,
  job: string,
  fn: (ctx: JobContext) => Promise<JobResult>,
  options: RunOptions = {},
): Promise<JobRun> {
  const dryRun = options.dryRun ?? false;
  const started = performance.now();
  const owner = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const log = options.log ?? (() => {});
  const elapsed = () => Math.round(performance.now() - started);

  if (!(await acquireLock(sql, job, owner, options.lockSeconds ?? 900))) {
    const stats = { reason: "locked" };
    const [row] = await sql<{ id: string }[]>`
      insert into public.job_runs (job_name, status, dry_run, finished_at, stats)
      values (${job}, 'skipped', ${dryRun}, now(), ${sql.json(stats)}) returning id`;
    return {
      id: row!.id,
      job,
      status: "skipped",
      dryRun,
      durationMs: elapsed(),
      stats,
      alerts: [],
    };
  }

  const [run] = await sql<{ id: string }[]>`
    insert into public.job_runs (job_name, status, dry_run)
    values (${job}, 'running', ${dryRun}) returning id`;
  const ctx: JobContext = {
    sql,
    dryRun,
    now: options.now ?? new Date(),
    log,
    write: writer(sql, dryRun),
  };

  try {
    const result = await fn(ctx);
    const status = result.status ?? "succeeded";
    const alerts = result.alerts ?? [];
    const stats = alerts.length ? { ...result.stats, alerts } : result.stats;
    await sql`
      update public.job_runs set
        status = ${status}, finished_at = now(), stats = ${sql.json(stats as postgres.JSONValue)},
        tokens_in = ${result.tokensIn ?? 0}, tokens_out = ${result.tokensOut ?? 0},
        ai_cost_usd = ${result.aiCostUsd ?? 0}
      where id = ${run!.id}`;
    return { id: run!.id, job, status, dryRun, durationMs: elapsed(), stats: result.stats, alerts };
  } catch (error) {
    const text = message(error);
    await sql`
      update public.job_runs set status = 'failed', finished_at = now(), error = ${text}
      where id = ${run!.id}`;
    return {
      id: run!.id,
      job,
      status: "failed",
      dryRun,
      durationMs: elapsed(),
      stats: {},
      alerts: [],
      error: text,
    };
  } finally {
    await sql`delete from public.job_locks where job_name = ${job} and locked_by = ${owner}`;
  }
}

/** Numeric app_settings value, or the fallback when missing or invalid. */
export async function numberSetting(sql: Sql | Tx, key: string, fallback: number): Promise<number> {
  const [row] = await sql<{ value: unknown }[]>`
    select value from public.app_settings where key = ${key}`;
  const n = Number(row?.value);
  return Number.isFinite(n) ? n : fallback;
}
