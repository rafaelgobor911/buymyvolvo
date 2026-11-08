/**
 * Job registry shared by the CLI (`npm run job`) and the cron routes
 * (/api/cron/<job>). Jobs take `sql` and their deps as parameters, so they run
 * the same way from scripts, tests and Next.js.
 */
import {
  prefilterOrigin,
  processPendingRawPosts,
  reprocessEditedCaptions,
} from "@/lib/extraction/pipeline";
import { addUsage } from "@/lib/extraction/cost";
import { prefilter } from "@/lib/extraction/prefilter";

import { collectBusinessDiscovery, collectHashtags } from "./collect";
import type { JobDeps, JobOptions } from "./deps";
import { expireListings, tokenHealth } from "./maintenance";
import { type JobContext, type JobResult, type JobRun, runJob, type Sql } from "./runner";

export { createJobDeps, type JobDeps, type JobOptions } from "./deps";
export type { JobRun } from "./runner";

/** Extraction of pending posts (Phase 2 pipeline) as a job. */
async function processPosts(
  ctx: JobContext,
  deps: JobDeps,
  options: JobOptions,
): Promise<JobResult> {
  const limit = options.limit ?? 50;
  if (ctx.dryRun) {
    // No AI calls in a dry run: report what would be sent to extraction.
    const pending = await ctx.sql<{ caption: string | null; source_type: string | null }[]>`
      select rp.caption, s.type as source_type from public.raw_posts rp
      left join public.sources s on s.id = rp.source_id
      where rp.processing_status = 'pending' and rp.gone_at is null
      order by rp.fetched_at, rp.id limit ${limit}`;
    const toExtract = pending.filter(
      (p) => prefilter(p.caption, { origin: prefilterOrigin(p.source_type) }).pass,
    ).length;
    const [edited] = await ctx.sql<{ n: number }[]>`
      select count(*)::int as n from public.raw_posts rp
      join public.listing_sources ls on ls.raw_post_id = rp.id and ls.is_primary
      join public.listings l on l.id = ls.listing_id
      where rp.caption_changed_at is not null
        and (rp.reprocessed_at is null or rp.reprocessed_at < rp.caption_changed_at)
        and rp.processing_status = 'extracted' and rp.gone_at is null
        and l.status in ('active', 'pending_review') and not l.is_claimed`;
    return {
      stats: { pending: pending.length, wouldExtract: toExtract, editedCaptions: edited?.n ?? 0 },
    };
  }
  const pipelineDeps = { extract: deps.extract(), now: () => ctx.now };
  const result = await processPendingRawPosts(ctx.sql, pipelineDeps, { limit });
  // Captions edited after extraction: price and km follow the post (history in audit_log).
  const edits = await reprocessEditedCaptions(ctx.sql, pipelineDeps, {
    limit: Math.max(5, limit - result.processed),
  });
  const u = addUsage(result.usage, edits.usage);
  const worked = result.processed + edits.checked;
  return {
    status: worked ? "succeeded" : "skipped",
    stats: {
      processed: result.processed,
      ...result.outcomes,
      ...(edits.checked
        ? {
            captionsRechecked: edits.checked,
            captionUpdates: edits.updated,
            captionErrors: edits.errors,
          }
        : {}),
    },
    tokensIn: u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens,
    tokensOut: u.outputTokens,
    aiCostUsd: Math.round((result.costUsd + edits.costUsd) * 10_000) / 10_000,
  };
}

export const JOBS = {
  "collect-business-discovery": {
    description: "Lê os posts recentes das contas de lojas (a cada 2–3h)",
    lockSeconds: 900,
    run: collectBusinessDiscovery,
  },
  "collect-hashtags": {
    description: "Lê as hashtags das últimas 24h dentro do orçamento de 30 por 7 dias (a cada 1h)",
    lockSeconds: 900,
    run: collectHashtags,
  },
  "process-posts": {
    description: "Pré-filtro + extração com IA dos posts pendentes",
    lockSeconds: 900,
    run: processPosts,
  },
  "token-health": {
    description: "Confere validade, vencimento e permissões do token (diário)",
    lockSeconds: 120,
    run: (ctx: JobContext, deps: JobDeps) => tokenHealth(ctx, deps),
  },
  "expire-listings": {
    description: "Expira anúncios só de hashtag após o prazo configurado (diário)",
    lockSeconds: 120,
    run: (ctx: JobContext) => expireListings(ctx),
  },
} satisfies Record<
  string,
  {
    description: string;
    lockSeconds: number;
    run: (ctx: JobContext, deps: JobDeps, options: JobOptions) => Promise<JobResult>;
  }
>;

export type JobName = keyof typeof JOBS;
export const JOB_NAMES = Object.keys(JOBS) as JobName[];
export const isJobName = (value: string): value is JobName => value in JOBS;

export function runNamedJob(
  sql: Sql,
  name: JobName,
  deps: JobDeps,
  options: JobOptions = {},
): Promise<JobRun> {
  const job = JOBS[name];
  return runJob(sql, name, (ctx) => job.run(ctx, deps, options), {
    dryRun: options.dryRun,
    now: options.now,
    log: options.log,
    lockSeconds: job.lockSeconds,
  });
}
