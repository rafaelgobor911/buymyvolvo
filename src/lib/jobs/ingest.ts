/**
 * Writes collected posts into raw_posts and applies the listing lifecycle
 * that the collection can observe (PROMPT.md §7.5.1 and §7.5.7).
 */
import { foldText } from "@/lib/extraction/text";
import { type IgMedia, mediaType } from "@/lib/instagram/api";

import type { Tx } from "./runner";

/** Sources used with the fixture world ("loja.demo", "volvoavenda_demo"). */
export const isFixtureHandle = (handle: string) => /[._]demo$/.test(handle);

/** The API writes "+0000"; normalize to a valid ISO offset. */
export function parseIgTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date;
}

const SOLD = /\b(vendido|vendida|vendidos|vendidas)\b/;

/** An edited caption that now says the car was sold. */
export function becameSold(before: string | null, after: string | null): boolean {
  return SOLD.test(foldText(after ?? "")) && !SOLD.test(foldText(before ?? ""));
}

export interface UpsertResult {
  inserted: number;
  /** raw_posts ids returned by this scan (new and known). */
  seenIds: string[];
  captionChanged: number;
  sold: number;
  blocked: number;
}

/**
 * Upsert by ig_media_id (idempotent). A known post gets last_seen_at, its
 * current caption and, if the caption changed to "vendido", its listings are
 * marked sold. The first source that found a post stays its source_id.
 */
export async function upsertPosts(
  tx: Tx,
  input: { sourceId: string; username: string | null; media: IgMedia[]; now: Date },
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, seenIds: [], captionChanged: 0, sold: 0, blocked: 0 };
  if (input.media.length === 0) return result;

  const ids = input.media.map((m) => m.id);
  const blocked = new Set(
    (
      await tx<{ value: string }[]>`
        select value from public.blocklist where kind = 'ig_media_id' and value = any(${ids})`
    ).map((r) => r.value),
  );
  const previous = new Map(
    (
      await tx<{ ig_media_id: string; caption: string | null }[]>`
        select ig_media_id, caption from public.raw_posts where ig_media_id = any(${ids})`
    ).map((r) => [r.ig_media_id, r.caption]),
  );

  const soldPostIds: string[] = [];
  for (const m of input.media) {
    if (blocked.has(m.id)) {
      result.blocked++;
      continue;
    }
    const caption = m.caption ?? null;
    const [row] = await tx<{ id: string; inserted: boolean }[]>`
      insert into public.raw_posts (
        ig_media_id, source_id, permalink, caption, media_type, ig_username, posted_at,
        fetched_at, last_seen_at
      ) values (
        ${m.id}, ${input.sourceId}, ${m.permalink}, ${caption}, ${mediaType(m.media_type)},
        ${input.username}, ${parseIgTimestamp(m.timestamp)}, ${input.now}, ${input.now}
      )
      on conflict (ig_media_id) do update set
        last_seen_at = excluded.last_seen_at,
        gone_at = null,
        permalink = excluded.permalink,
        ig_username = coalesce(public.raw_posts.ig_username, excluded.ig_username),
        caption_changed_at = case
          when excluded.caption is not null and public.raw_posts.caption is distinct from excluded.caption
          then excluded.last_seen_at else public.raw_posts.caption_changed_at end,
        caption = coalesce(excluded.caption, public.raw_posts.caption)
      returning id, (xmax = 0) as inserted`;
    result.seenIds.push(row!.id);
    if (row!.inserted) {
      result.inserted++;
      continue;
    }
    const before = previous.get(m.id) ?? null;
    if (caption !== null && before !== caption) {
      result.captionChanged++;
      if (becameSold(before, caption)) soldPostIds.push(row!.id);
    }
  }

  if (result.seenIds.length) {
    await tx`
      update public.listings l set last_seen_at = ${input.now}
      from public.listing_sources ls
      where ls.listing_id = l.id and ls.raw_post_id = any(${result.seenIds})
        and l.status in ('active', 'pending_review')`;
  }
  if (soldPostIds.length) {
    const sold = await tx`
      update public.listings l set status = 'sold', sold_at = ${input.now}
      from public.listing_sources ls
      where ls.listing_id = l.id and ls.raw_post_id = any(${soldPostIds})
        and l.status in ('active', 'pending_review')
      returning l.id`;
    result.sold = sold.length;
  }
  return result;
}

/**
 * Business Discovery only: posts of the source inside the window the scan
 * covered (from its oldest post on, or everything when it reached the end)
 * that the API no longer returns were deleted or archived. Their listings
 * expire when no other live post backs them.
 */
export async function markGone(
  tx: Tx,
  input: { sourceId: string; seenIds: string[]; windowStart: Date | null; now: Date },
): Promise<{ gone: number; expired: number }> {
  const gone = await tx<{ id: string }[]>`
    update public.raw_posts set gone_at = ${input.now}
    where source_id = ${input.sourceId} and gone_at is null and posted_at is not null
      and not (id = any(${input.seenIds}))
      and (${input.windowStart}::timestamptz is null or posted_at >= ${input.windowStart})
    returning id`;
  if (gone.length === 0) return { gone: 0, expired: 0 };
  const goneIds = gone.map((g) => g.id);
  const expired = await tx`
    update public.listings l set status = 'expired', expires_at = ${input.now}
    where l.status in ('active', 'pending_review') and l.origin = 'instagram'
      and l.id in (select listing_id from public.listing_sources where raw_post_id = any(${goneIds}))
      and not exists (
        select 1 from public.listing_sources ls
        join public.raw_posts rp on rp.id = ls.raw_post_id
        where ls.listing_id = l.id and rp.gone_at is null)
    returning l.id`;
  return { gone: gone.length, expired: expired.length };
}
