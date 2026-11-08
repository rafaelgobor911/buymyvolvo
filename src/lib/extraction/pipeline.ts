/**
 * raw_post → listing. Runs server-side with the table owner's connection
 * (cron routes in Phase 3, scripts, tests); takes `sql` as a parameter so it
 * never imports the Next.js-only DB client.
 *
 * Order (PROMPT.md §7.5): blocklist → pre-filter → extraction → normalization
 * and coherence → blocklist (phone) → deduplication → publish or moderate.
 * Idempotent: a raw_post leaves `pending` exactly once, and a post already
 * linked to a listing is never linked again.
 */
import { randomBytes } from "node:crypto";

import type postgres from "postgres";

import { listingSlug } from "@/lib/listings/format";
import { getEngine, getModel, getTrim } from "@/lib/taxonomy";

import { addUsage, emptyUsage, estimateCostUsd, type TokenUsage } from "./cost";
import { dedupeKey, isLikelySameCar } from "./dedupe";
import { type ExtractInput, type ExtractResult, ExtractionError } from "./extract";
import { hasMinimumFields, type NormalizedListing, normalizeExtraction } from "./normalize";
import { prefilter, type PrefilterOrigin } from "./prefilter";
import { EXTRACTION_PROMPT_VERSION } from "./prompt";

type Sql = postgres.Sql | postgres.TransactionSql;

export interface PipelineDeps {
  extract: (input: ExtractInput) => Promise<ExtractResult>;
  now?: () => Date;
}

export type PipelineOutcome =
  | "blocklisted"
  | "prefiltered_out"
  | "not_listing"
  | "error"
  | "published"
  | "moderation"
  | "merged"
  | "skipped_removed";

export interface PipelineStats {
  processed: number;
  outcomes: Record<PipelineOutcome, number>;
  usage: TokenUsage;
  costUsd: number;
}

interface RawPostRow {
  id: string;
  ig_media_id: string;
  caption: string | null;
  ig_username: string | null;
  posted_at: Date | null;
  /** Bio of the account (Business Discovery sources): contact and city fallback. */
  bio?: string | null;
  /** sources.type of the post's source, which sets the pre-filter's Brazil rule. */
  source_type?: string | null;
}

/** Pre-filter origin for a source type (null for posts without a known source). */
export function prefilterOrigin(
  sourceType: string | null | undefined,
): PrefilterOrigin | undefined {
  if (sourceType === "ig_business_account") return "business_discovery";
  if (sourceType === "ig_hashtag") return "hashtag";
  return undefined;
}

const DEFAULT_THRESHOLD = 0.85;

async function publishThreshold(sql: Sql): Promise<number> {
  const [row] = await sql<{ value: unknown }[]>`
    select value from public.app_settings where key = 'publish_confidence_threshold'`;
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_THRESHOLD;
}

async function isBlocked(sql: Sql, kind: string, value: string | null): Promise<boolean> {
  if (!value) return false;
  const [row] = await sql<{ blocked: boolean }[]>`
    select exists (select 1 from public.blocklist where kind = ${kind} and value = ${value}) as blocked`;
  return row?.blocked ?? false;
}

async function finish(
  sql: Sql,
  id: string,
  status: "not_listing" | "extracted" | "error",
  details: Record<string, unknown>,
  result?: { model: string; usage: TokenUsage },
  error?: string,
) {
  await sql`
    update public.raw_posts set
      processing_status = ${status},
      extraction_json = ${sql.json(details as postgres.JSONValue)},
      extraction_model = ${result?.model ?? null},
      tokens_in = ${result ? result.usage.inputTokens + result.usage.cacheReadTokens + result.usage.cacheWriteTokens : null},
      tokens_out = ${result?.usage.outputTokens ?? null},
      error = ${error ?? null}
    where id = ${id} and processing_status = 'pending'`;
}

const shortId = () => randomBytes(4).readUInt32BE(0).toString(36).padStart(6, "0").slice(-6);

async function findExistingListing(
  sql: Sql,
  n: NormalizedListing,
  key: string | null,
  caption: string,
): Promise<{ id: string; status: string } | null> {
  if (key) {
    const [exact] = await sql<{ id: string; status: string }[]>`
      select id, status from public.listings where dedupe_key = ${key} order by created_at limit 1`;
    if (exact) return exact;
  }
  if (!n.modelId || !n.yearModel || (!n.contactPhone && !n.contactIgUsername)) return null;
  const candidates = await sql<
    {
      id: string;
      status: string;
      km: number | null;
      contact_phone_e164: string | null;
      contact_ig_username: string | null;
      caption: string | null;
    }[]
  >`
    select l.id, l.status, l.km, l.contact_phone_e164, l.contact_ig_username, rp.caption
    from public.listings l
    left join public.listing_sources ls on ls.listing_id = l.id and ls.is_primary
    left join public.raw_posts rp on rp.id = ls.raw_post_id
    where l.model_id = ${n.modelId} and l.year_model = ${n.yearModel}
      and (l.contact_phone_e164 = ${n.contactPhone ?? ""} or l.contact_ig_username = ${n.contactIgUsername ?? ""})
    order by l.created_at
    limit 20`;
  const me = {
    modelId: n.modelId,
    yearModel: n.yearModel,
    km: n.km,
    contactPhone: n.contactPhone,
    contactIgUsername: n.contactIgUsername,
    text: caption,
  };
  const match = candidates.find((c) =>
    isLikelySameCar(me, {
      modelId: n.modelId!,
      yearModel: n.yearModel,
      km: c.km,
      contactPhone: c.contact_phone_e164,
      contactIgUsername: c.contact_ig_username,
      text: c.caption ?? "",
    }),
  );
  return match ? { id: match.id, status: match.status } : null;
}

export async function processRawPost(
  sql: postgres.Sql,
  post: RawPostRow,
  deps: PipelineDeps,
  threshold: number,
): Promise<{ outcome: PipelineOutcome; usage: TokenUsage; model?: string }> {
  const now = deps.now?.() ?? new Date();
  const caption = post.caption ?? "";
  const username = post.ig_username?.toLowerCase() ?? null;
  const base = { prompt_version: EXTRACTION_PROMPT_VERSION };

  if (
    (await isBlocked(sql, "ig_media_id", post.ig_media_id)) ||
    (await isBlocked(sql, "ig_username", username))
  ) {
    await finish(sql, post.id, "not_listing", { ...base, skipped: "blocklisted" });
    return { outcome: "blocklisted", usage: emptyUsage() };
  }

  const filter = prefilter(caption, { origin: prefilterOrigin(post.source_type) });
  if (!filter.pass) {
    await finish(sql, post.id, "not_listing", { ...base, prefilter: filter });
    return { outcome: "prefiltered_out", usage: emptyUsage() };
  }

  let result: ExtractResult;
  try {
    result = await deps.extract({
      caption,
      igUsername: username,
      bio: post.bio ?? null,
      postedAt: post.posted_at?.toISOString() ?? null,
    });
  } catch (error) {
    const usage = error instanceof ExtractionError ? error.usage : emptyUsage();
    const message = error instanceof Error ? error.message : String(error);
    await finish(
      sql,
      post.id,
      "error",
      { ...base, prefilter: filter },
      undefined,
      message.slice(0, 500),
    );
    return { outcome: "error", usage };
  }

  const n = normalizeExtraction(result.output, {
    caption,
    igUsername: username,
    bio: post.bio ?? null,
    now,
  });
  const details = { ...base, prefilter: filter, extraction: result.output, normalized: n };

  if (!n.isListing || !n.modelId) {
    await finish(sql, post.id, "not_listing", details, result);
    return { outcome: "not_listing", usage: result.usage, model: result.model };
  }
  if (await isBlocked(sql, "phone", n.contactPhone)) {
    await finish(sql, post.id, "not_listing", { ...details, skipped: "blocklisted" }, result);
    return { outcome: "blocklisted", usage: result.usage, model: result.model };
  }

  const key = dedupeKey(n);
  const outcome = await sql.begin(async (tx) => {
    const existing = await findExistingListing(tx, n, key, caption);
    if (existing) {
      if (existing.status === "removed") return "skipped_removed" as const;
      await tx`update public.listings set last_seen_at = ${now} where id = ${existing.id}`;
      await tx`
        insert into public.listing_sources (listing_id, raw_post_id, is_primary)
        values (${existing.id}, ${post.id}, false)
        on conflict (raw_post_id) do nothing`;
      return "merged" as const;
    }

    const publish = n.confidence >= threshold && hasMinimumFields(n);
    const slug = listingSlug(
      {
        modelName: getModel(n.modelId!)!.name,
        engineName: n.engineId ? getEngine(n.engineId)?.name : null,
        trimName: n.trimId ? getTrim(n.trimId)?.name : null,
        yearModel: n.yearModel,
        city: n.city,
        uf: n.uf,
      },
      shortId(),
    );
    const [listing] = await tx<{ id: string }[]>`
      insert into public.listings (
        slug, status, origin, model_id, engine_id, trim_id, version_text, year_fab, year_model,
        km, price_cents, city, uf, color, transmission, fuel, options, summary_ptbr, seller_type,
        contact_phone_e164, contact_ig_username, confidence, red_flags, first_seen_at,
        last_seen_at, dedupe_key
      ) values (
        ${slug}, ${publish ? "active" : "pending_review"}, 'instagram', ${n.modelId}, ${n.engineId},
        ${n.trimId}, ${n.versionText}, ${n.yearFab}, ${n.yearModel}, ${n.km}, ${n.priceCents},
        ${n.city}, ${n.uf}, ${n.color}, ${n.transmission}, ${n.fuel}, ${n.options},
        ${n.summary || null}, ${n.sellerType}, ${n.contactPhone}, ${n.contactIgUsername},
        ${n.confidence}, ${n.redFlags}, ${post.posted_at ?? now}, ${now}, ${key}
      ) returning id`;
    await tx`
      insert into public.listing_sources (listing_id, raw_post_id, is_primary)
      values (${listing!.id}, ${post.id}, true)`;
    return publish ? ("published" as const) : ("moderation" as const);
  });

  await finish(sql, post.id, "extracted", { ...details, outcome }, result);
  return { outcome, usage: result.usage, model: result.model };
}

/** Processes pending raw_posts, oldest first. */
export async function processPendingRawPosts(
  sql: postgres.Sql,
  deps: PipelineDeps,
  options: { limit?: number } = {},
): Promise<PipelineStats> {
  const threshold = await publishThreshold(sql);
  const posts = await sql<RawPostRow[]>`
    select rp.id, rp.ig_media_id, rp.caption, rp.ig_username, rp.posted_at, s.type as source_type,
      case when s.type = 'ig_business_account' then s.ig_biography end as bio
    from public.raw_posts rp
    left join public.sources s on s.id = rp.source_id
    where rp.processing_status = 'pending' and rp.gone_at is null
    order by rp.fetched_at, rp.id
    limit ${options.limit ?? 50}`;

  const stats: PipelineStats = {
    processed: 0,
    outcomes: {
      blocklisted: 0,
      prefiltered_out: 0,
      not_listing: 0,
      error: 0,
      published: 0,
      moderation: 0,
      merged: 0,
      skipped_removed: 0,
    },
    usage: emptyUsage(),
    costUsd: 0,
  };
  for (const post of posts) {
    const { outcome, usage, model } = await processRawPost(sql, post, deps, threshold);
    stats.processed++;
    stats.outcomes[outcome]++;
    stats.usage = addUsage(stats.usage, usage);
    stats.costUsd += (model && estimateCostUsd(model, usage)) || 0;
  }
  return stats;
}
