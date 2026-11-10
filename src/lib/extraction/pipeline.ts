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
import { fillLocation } from "./location";
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
  /** Distinct extraction errors (first few), for the job alert. */
  errorMessages: string[];
}

/** An error message safe to show (no API keys), short. */
export const publicErrorMessage = (message: string) =>
  message
    .replace(/sk-ant-[\w-]+/g, "sk-ant-…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

/**
 * Puts posts whose extraction failed (missing or invalid API key, outage)
 * back in the queue, once the cause is fixed. Only recent ones, still on
 * Instagram. Returns how many.
 */
export async function requeueFailedRawPosts(
  sql: postgres.Sql,
  options: { days?: number } = {},
): Promise<number> {
  const rows = await sql`
    update public.raw_posts set processing_status = 'pending', error = null
    where processing_status = 'error' and gone_at is null
      and fetched_at > now() - make_interval(days => ${options.days ?? 14})
    returning id`;
  return rows.length;
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
  /** The shop's default location (admin, Fontes), used when the post does not say. */
  default_city?: string | null;
  default_uf?: string | null;
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
): Promise<{ outcome: PipelineOutcome; usage: TokenUsage; model?: string; error?: string }> {
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
    return { outcome: "error", usage, error: message };
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
      // Moderation rejected it, but the seller posted the car again: review it again.
      if (existing.status === "rejected") {
        await tx`update public.listings set status = 'pending_review' where id = ${existing.id}`;
        await tx`
          insert into public.audit_log (actor, action, entity, entity_id, changes, note)
          values ('system:process-posts', 'listing.reopen', 'listing', ${existing.id},
            ${tx.json({ status: { from: "rejected", to: "pending_review" } })},
            'Repostagem de um anúncio rejeitado')`;
      }
      await tx`
        insert into public.listing_sources (listing_id, raw_post_id, is_primary)
        values (${existing.id}, ${post.id}, false)
        on conflict (raw_post_id) do nothing`;
      return "merged" as const;
    }

    const publish = n.confidence >= threshold && hasMinimumFields(n);
    const place = fillLocation(
      { city: n.city, uf: n.uf },
      { sourceCity: post.default_city, sourceUf: post.default_uf, phone: n.contactPhone },
    );
    const slug = listingSlug(
      {
        modelName: getModel(n.modelId!)!.name,
        engineName: n.engineId ? getEngine(n.engineId)?.name : null,
        trimName: n.trimId ? getTrim(n.trimId)?.name : null,
        yearModel: n.yearModel,
        city: place.city,
        uf: place.uf,
      },
      shortId(),
    );
    const [listing] = await tx<{ id: string }[]>`
      insert into public.listings (
        slug, status, origin, model_id, engine_id, trim_id, version_text, year_fab, year_model,
        km, price_cents, city, uf, color, transmission, fuel, options, summary_ptbr, seller_type,
        contact_phone_e164, contact_ig_username, confidence, red_flags, first_seen_at,
        last_seen_at, dedupe_key, uf_from_ddd
      ) values (
        ${slug}, ${publish ? "active" : "pending_review"}, 'instagram', ${n.modelId}, ${n.engineId},
        ${n.trimId}, ${n.versionText}, ${n.yearFab}, ${n.yearModel}, ${n.km}, ${n.priceCents},
        ${place.city}, ${place.uf}, ${n.color}, ${n.transmission}, ${n.fuel}, ${n.options},
        ${n.summary || null}, ${n.sellerType}, ${n.contactPhone}, ${n.contactIgUsername},
        ${n.confidence}, ${n.redFlags}, ${post.posted_at ?? now}, ${now}, ${key}, ${place.ufFromDdd}
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
      case when s.type = 'ig_business_account' then s.ig_biography end as bio,
      case when s.type = 'ig_business_account' then s.default_city end as default_city,
      case when s.type = 'ig_business_account' then s.default_uf end as default_uf
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
    errorMessages: [],
  };
  for (const post of posts) {
    const { outcome, usage, model, error } = await processRawPost(sql, post, deps, threshold);
    stats.processed++;
    stats.outcomes[outcome]++;
    if (error) {
      const text = publicErrorMessage(error);
      if (stats.errorMessages.length < 3 && !stats.errorMessages.includes(text)) {
        stats.errorMessages.push(text);
      }
    }
    stats.usage = addUsage(stats.usage, usage);
    stats.costUsd += (model && estimateCostUsd(model, usage)) || 0;
  }
  return stats;
}

export interface ReprocessStats {
  checked: number;
  updated: number;
  errors: number;
  usage: TokenUsage;
  costUsd: number;
}

/**
 * Captions edited on Instagram after extraction (raw_posts.caption_changed_at):
 * re-extract once per edit and update the price and km of listings that are
 * still the pipeline's work (not claimed by a seller). The previous values go
 * to audit_log. "Vendido" edits are handled at collection time (ingest).
 */
export async function reprocessEditedCaptions(
  sql: postgres.Sql,
  deps: PipelineDeps,
  options: { limit?: number } = {},
): Promise<ReprocessStats> {
  const posts = await sql<
    (RawPostRow & { listing_id: string; price_cents: string | null; km: number | null })[]
  >`
    select rp.id, rp.ig_media_id, rp.caption, rp.ig_username, rp.posted_at,
      s.type as source_type,
      case when s.type = 'ig_business_account' then s.ig_biography end as bio,
      l.id as listing_id, l.price_cents, l.km
    from public.raw_posts rp
    join public.listing_sources ls on ls.raw_post_id = rp.id and ls.is_primary
    join public.listings l on l.id = ls.listing_id
    left join public.sources s on s.id = rp.source_id
    where rp.caption_changed_at is not null
      and (rp.reprocessed_at is null or rp.reprocessed_at < rp.caption_changed_at)
      and rp.processing_status = 'extracted' and rp.gone_at is null
      and l.status in ('active', 'pending_review') and not l.is_claimed
    order by rp.caption_changed_at, rp.id
    limit ${options.limit ?? 20}`;

  const stats: ReprocessStats = {
    checked: 0,
    updated: 0,
    errors: 0,
    usage: emptyUsage(),
    costUsd: 0,
  };
  for (const post of posts) {
    const now = deps.now?.() ?? new Date();
    stats.checked++;
    const caption = post.caption ?? "";
    const done = () =>
      sql`update public.raw_posts set reprocessed_at = ${now} where id = ${post.id}`;
    if (!prefilter(caption, { origin: prefilterOrigin(post.source_type) }).pass) {
      await done();
      continue;
    }
    let result: ExtractResult;
    try {
      result = await deps.extract({
        caption,
        igUsername: post.ig_username?.toLowerCase() ?? null,
        bio: post.bio ?? null,
        postedAt: post.posted_at?.toISOString() ?? null,
      });
    } catch (error) {
      stats.errors++;
      if (error instanceof ExtractionError) stats.usage = addUsage(stats.usage, error.usage);
      await done();
      continue;
    }
    stats.usage = addUsage(stats.usage, result.usage);
    stats.costUsd += estimateCostUsd(result.model, result.usage) || 0;
    const n = normalizeExtraction(result.output, {
      caption,
      igUsername: post.ig_username?.toLowerCase() ?? null,
      bio: post.bio ?? null,
      now,
    });

    const before = {
      priceCents: post.price_cents === null ? null : Number(post.price_cents),
      km: post.km,
    };
    const changes: Record<string, { from: number | null; to: number }> = {};
    if (n.isListing && n.priceCents !== null && n.priceCents !== before.priceCents) {
      changes.priceCents = { from: before.priceCents, to: n.priceCents };
    }
    if (n.isListing && n.km !== null && n.km !== before.km)
      changes.km = { from: before.km, to: n.km };

    await sql.begin(async (tx) => {
      if (Object.keys(changes).length) {
        await tx`
          update public.listings set
            price_cents = ${changes.priceCents?.to ?? before.priceCents},
            km = ${changes.km?.to ?? before.km}
          where id = ${post.listing_id}`;
        await tx`
          insert into public.audit_log (actor, action, entity, entity_id, changes, note)
          values ('system:process-posts', 'listing.caption_update', 'listing', ${post.listing_id},
            ${tx.json(changes)}, 'Legenda editada no Instagram')`;
      }
      await tx`update public.raw_posts set reprocessed_at = ${now} where id = ${post.id}`;
    });
    if (Object.keys(changes).length) stats.updated++;
  }
  return stats;
}
