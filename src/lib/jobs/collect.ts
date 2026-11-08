/**
 * Collection jobs: Business Discovery (shops' professional accounts, every
 * 2–3h) and Hashtag Search (every hour, within the 30-per-7-days budget).
 */
import {
  hashtagId,
  type IgMedia,
  recentHashtagMedia,
  recentlySearchedHashtags,
  scanBusinessAccount,
} from "@/lib/instagram/api";
import { GraphError } from "@/lib/instagram/graph";

import type { JobDeps, JobOptions } from "./deps";
import { isFixtureHandle, markGone, parseIgTimestamp, upsertPosts } from "./ingest";
import { type JobContext, type JobResult, numberSetting, type Sql, type Tx } from "./runner";

interface SourceRow {
  id: string;
  handle: string;
}

/** Sources of a type that are due (or all active ones with `force`). */
async function dueSources(
  ctx: JobContext,
  deps: JobDeps,
  type: "ig_business_account" | "ig_hashtag",
  options: JobOptions,
): Promise<SourceRow[]> {
  const rows = await ctx.sql<SourceRow[]>`
    select id, handle from public.sources
    where type = ${type} and active
      and (${options.force ?? false}::boolean or last_polled_at is null
           or last_polled_at + make_interval(mins => poll_interval_minutes) <= ${ctx.now})
    order by last_polled_at nulls first, handle`;
  const fixtures = deps.mode === "fixtures";
  return rows.filter(
    (s) =>
      isFixtureHandle(s.handle) === fixtures &&
      (!options.only?.length || options.only.includes(s.handle)),
  );
}

async function recordSourceError(tx: Tx, sourceId: string, error: string, now: Date) {
  await tx`
    update public.sources set
      last_error = ${error.slice(0, 500)}, last_error_at = ${now}, last_polled_at = ${now},
      consecutive_failures = consecutive_failures + 1
    where id = ${sourceId}`;
}

const NOT_FOUND_MESSAGE =
  "Conta não encontrada, pessoal ou com restrição de idade: o Business Discovery só lê contas profissionais.";

function sourceErrorMessage(error: GraphError): string {
  if (error.kind === "not_found") return NOT_FOUND_MESSAGE;
  if (error.kind === "permission") return `Sem permissão para esta consulta: ${error.message}`;
  return error.message;
}

const oldestPost = (media: IgMedia[]) =>
  new Date(Math.min(...media.map((m) => parseIgTimestamp(m.timestamp)?.getTime() ?? Infinity)));

// ---------------------------------------------------------------------------
// Business Discovery
// ---------------------------------------------------------------------------

export async function collectBusinessDiscovery(
  ctx: JobContext,
  deps: JobDeps,
  options: JobOptions = {},
): Promise<JobResult> {
  const sources = await dueSources(ctx, deps, "ig_business_account", options);
  const stats = {
    sources: sources.length,
    scanned: 0,
    unavailable: 0,
    failed: 0,
    posts: 0,
    new: 0,
    captionChanged: 0,
    sold: 0,
    gone: 0,
    expired: 0,
    blocked: 0,
    stoppedEarly: null as null | "rate_limit" | "usage",
    apiRequests: 0,
  };
  const alerts: string[] = [];
  if (sources.length === 0) return { stats, status: "skipped" };

  const client = deps.graph();
  const igUserId = deps.igUserId();
  const requestsBefore = client.requests;
  const pages = await numberSetting(ctx.sql, "business_discovery_pages", 2);

  for (const source of sources) {
    if (client.nearLimit(90)) {
      stats.stoppedEarly = "usage";
      alerts.push("Uso da API da Meta acima de 90%: coleta interrompida até a próxima execução.");
      break;
    }
    const blocked = await ctx.sql`
      select 1 from public.blocklist where kind = 'ig_username' and value = ${source.handle}`;
    if (blocked.length) {
      stats.blocked++;
      continue;
    }
    try {
      const scan = await scanBusinessAccount(client, igUserId, source.handle, { pages });
      const result = await ctx.write(async (tx) => {
        await tx`
          update public.sources set
            ig_user_id = ${scan.profile.igId}, ig_name = ${scan.profile.name},
            ig_biography = ${scan.profile.biography}, ig_website = ${scan.profile.website},
            ig_media_count = ${scan.profile.mediaCount}, profile_fetched_at = ${ctx.now},
            last_polled_at = ${ctx.now}, last_error = null, last_error_at = null,
            consecutive_failures = 0
          where id = ${source.id}`;
        const upsert = await upsertPosts(tx, {
          sourceId: source.id,
          username: scan.profile.username.toLowerCase(),
          media: scan.media,
          now: ctx.now,
        });
        // Only judge disappearances when the scan returned something (an empty
        // answer from an account that has posts is more likely a glitch).
        const lifecycle =
          scan.media.length > 0 || scan.profile.mediaCount === 0
            ? await markGone(tx, {
                sourceId: source.id,
                seenIds: upsert.seenIds,
                windowStart: scan.reachedEnd ? null : oldestPost(scan.media),
                now: ctx.now,
              })
            : { gone: 0, expired: 0 };
        return { upsert, lifecycle };
      });
      stats.scanned++;
      stats.posts += scan.media.length;
      stats.new += result.upsert.inserted;
      stats.captionChanged += result.upsert.captionChanged;
      stats.sold += result.upsert.sold;
      stats.blocked += result.upsert.blocked;
      stats.gone += result.lifecycle.gone;
      stats.expired += result.lifecycle.expired;
      ctx.log(`@${source.handle}: ${scan.media.length} posts, ${result.upsert.inserted} novos`);
    } catch (error) {
      if (!(error instanceof GraphError)) throw error;
      if (error.kind === "auth")
        throw new Error(`Token do Instagram inválido ou expirado: ${error.message}`);
      await ctx.write((tx) => recordSourceError(tx, source.id, sourceErrorMessage(error), ctx.now));
      ctx.log(`@${source.handle}: ${sourceErrorMessage(error)}`);
      if (error.kind === "rate_limit") {
        stats.stoppedEarly = "rate_limit";
        alerts.push("Limite de requisições da Meta atingido: coleta interrompida.");
        break;
      }
      if (error.kind === "not_found") stats.unavailable++;
      else stats.failed++;
    }
  }
  stats.apiRequests = client.requests - requestsBefore;
  return { stats, alerts };
}

// ---------------------------------------------------------------------------
// Hashtag Search
// ---------------------------------------------------------------------------

/** Meta allows 30 unique hashtags per rolling 7 days, per Instagram account. */
export const HASHTAG_WINDOW_DAYS = 7;

interface BudgetRow {
  id: string;
  hashtag: string;
  ig_hashtag_id: string | null;
}

async function activeBudget(tx: Sql | Tx, igUserId: string, now: Date): Promise<BudgetRow[]> {
  return tx<BudgetRow[]>`
    select id, hashtag, ig_hashtag_id from public.hashtag_budget
    where ig_user_id = ${igUserId}
      and window_started_at > ${now}::timestamptz - make_interval(days => ${HASHTAG_WINDOW_DAYS})
    order by window_started_at`;
}

/**
 * Adds hashtags Meta already counts (e.g. searched by hand in the Graph API
 * Explorer) so our budget never undercounts. Unknown ones are named ext_<id>.
 */
async function syncBudget(tx: Tx, igUserId: string, searchedIds: string[], now: Date) {
  const active = await activeBudget(tx, igUserId, now);
  let added = 0;
  for (const id of searchedIds) {
    if (active.some((a) => a.ig_hashtag_id === id)) continue;
    const [known] = await tx<{ hashtag: string }[]>`
      select hashtag from public.hashtag_budget
      where ig_user_id = ${igUserId} and ig_hashtag_id = ${id} limit 1`;
    await tx`
      insert into public.hashtag_budget (ig_user_id, hashtag, ig_hashtag_id, window_started_at, last_queried_at)
      values (${igUserId}, ${known?.hashtag ?? `ext_${id}`}, ${id}, ${now}, ${now})
      on conflict do nothing`;
    added++;
  }
  return added;
}

export async function collectHashtags(
  ctx: JobContext,
  deps: JobDeps,
  options: JobOptions = {},
): Promise<JobResult> {
  const sources = await dueSources(ctx, deps, "ig_hashtag", options);
  const stats = {
    sources: sources.length,
    queried: 0,
    budgetUsed: 0,
    budgetMax: 0,
    skippedForBudget: 0,
    wouldConsumeSlot: 0,
    syncedFromMeta: 0,
    posts: 0,
    new: 0,
    blocked: 0,
    failed: 0,
    stoppedEarly: null as null | "rate_limit" | "permission",
    apiRequests: 0,
  };
  const alerts: string[] = [];
  if (sources.length === 0) return { stats, status: "skipped" };

  const client = deps.graph();
  const igUserId = deps.igUserId();
  const requestsBefore = client.requests;
  stats.budgetMax = Math.min(30, await numberSetting(ctx.sql, "hashtag_budget_max", 25));

  stats.syncedFromMeta = await ctx.write(async (tx) =>
    syncBudget(tx, igUserId, await recentlySearchedHashtags(client, igUserId), ctx.now),
  );

  for (const source of sources) {
    try {
      const outcome = await ctx.write(async (tx) => {
        const active = await activeBudget(tx, igUserId, ctx.now);
        let entry = active.find((a) => a.hashtag === source.handle);
        if (!entry) {
          if (ctx.dryRun && deps.mode === "live") return "would_consume" as const;
          if (active.length >= stats.budgetMax) return "budget" as const;
          [entry] = await tx<BudgetRow[]>`
            insert into public.hashtag_budget (ig_user_id, hashtag, window_started_at, last_queried_at)
            values (${igUserId}, ${source.handle}, ${ctx.now}, ${ctx.now})
            returning id, hashtag, ig_hashtag_id`;
        }
        let tagId = entry!.ig_hashtag_id;
        if (!tagId) {
          const [known] = await tx<{ ig_hashtag_id: string }[]>`
            select ig_hashtag_id from public.hashtag_budget
            where hashtag = ${source.handle} and ig_hashtag_id is not null limit 1`;
          tagId = known?.ig_hashtag_id ?? (await hashtagId(client, igUserId, source.handle));
        }
        await tx`
          update public.hashtag_budget set ig_hashtag_id = ${tagId}, last_queried_at = ${ctx.now}
          where id = ${entry!.id}`;
        const media = tagId ? await recentHashtagMedia(client, igUserId, tagId) : [];
        const upsert = await upsertPosts(tx, {
          sourceId: source.id,
          username: null,
          media,
          now: ctx.now,
        });
        await tx`
          update public.sources set last_polled_at = ${ctx.now}, last_error = null,
            last_error_at = null, consecutive_failures = 0
          where id = ${source.id}`;
        return { media: media.length, upsert };
      });
      if (outcome === "would_consume") {
        stats.wouldConsumeSlot++;
        ctx.log(`#${source.handle}: consumiria uma vaga nova (não consultada no dry-run)`);
        continue;
      }
      if (outcome === "budget") {
        stats.skippedForBudget++;
        continue;
      }
      stats.queried++;
      stats.posts += outcome.media;
      stats.new += outcome.upsert.inserted;
      stats.blocked += outcome.upsert.blocked;
      ctx.log(
        `#${source.handle}: ${outcome.media} posts nas últimas 24h, ${outcome.upsert.inserted} novos`,
      );
    } catch (error) {
      if (!(error instanceof GraphError)) throw error;
      if (error.kind === "auth")
        throw new Error(`Token do Instagram inválido ou expirado: ${error.message}`);
      await ctx.write((tx) => recordSourceError(tx, source.id, sourceErrorMessage(error), ctx.now));
      stats.failed++;
      if (error.kind === "rate_limit" || error.kind === "permission") {
        stats.stoppedEarly = error.kind;
        alerts.push(
          error.kind === "permission"
            ? "A Meta recusou a busca por hashtag (pode exigir o App Review de Instagram Public Content Access)."
            : "Limite de requisições da Meta atingido: coleta de hashtags interrompida.",
        );
        break;
      }
    }
  }

  stats.budgetUsed = (await activeBudget(ctx.sql, igUserId, ctx.now)).length;
  if (stats.skippedForBudget) {
    alerts.push(
      `Orçamento de hashtags esgotado (${stats.budgetUsed}/${stats.budgetMax} em 7 dias): ${stats.skippedForBudget} hashtag(s) ficaram de fora.`,
    );
  }
  stats.apiRequests = client.requests - requestsBefore;
  return { stats, alerts };
}
