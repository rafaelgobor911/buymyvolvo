/**
 * Cron entry point: GET or POST /api/cron/<job> with
 * `Authorization: Bearer <CRON_SECRET>` (the header Vercel Cron sends).
 * `?dry_run=1` runs without keeping any write; `?retry_errors=1` (process-posts)
 * first puts posts whose extraction failed back in the queue. Each job is idempotent and
 * holds a lease lock, so overlapping triggers are harmless.
 */
import { timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db/client";
import { serverEnv } from "@/lib/env/server";
import { createJobDeps, isJobName, runNamedJob } from "@/lib/jobs";

export const maxDuration = 300;

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const env = serverEnv();
  if (!env.CRON_SECRET) {
    return Response.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (!sameSecret(request.headers.get("authorization") ?? "", `Bearer ${env.CRON_SECRET}`)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { job } = await ctx.params;
  if (!isJobName(job)) return Response.json({ error: "Job desconhecido." }, { status: 404 });

  const query = new URL(request.url).searchParams;
  const dryRun = query.get("dry_run") === "1";
  const retryErrors = query.get("retry_errors") === "1";
  // Leave room under maxDuration: sources not reached stay due for the next call.
  const run = await runNamedJob(db(), job, createJobDeps(env), {
    dryRun,
    retryErrors,
    maxSeconds: 240,
  });
  return Response.json(run, { status: run.status === "failed" ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
