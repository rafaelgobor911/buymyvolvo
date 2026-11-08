/**
 * Monitored Instagram sources and the hashtag budget, for the admin.
 * Receives `sql` by parameter; changes go to audit_log.
 */
import type postgres from "postgres";

import { normalizeUsername } from "@/lib/instagram/api";

type Sql = postgres.Sql;

export type SourceType = "ig_business_account" | "ig_hashtag";

/** Hashtags run once a day (product decision); shop accounts every 3 hours. */
export const DEFAULT_INTERVAL: Record<SourceType, number> = {
  ig_business_account: 180,
  ig_hashtag: 1440,
};

export interface SourceRow {
  id: string;
  type: string;
  handle: string;
  active: boolean;
  pollIntervalMinutes: number;
  lastPolledAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  igName: string | null;
  posts: number;
  listings: number;
}

export async function listSources(sql: Sql): Promise<SourceRow[]> {
  return sql<SourceRow[]>`
    select s.id, s.type, s.handle, s.active, s.poll_interval_minutes as "pollIntervalMinutes",
      s.last_polled_at as "lastPolledAt", s.last_error as "lastError",
      s.consecutive_failures as "consecutiveFailures", s.ig_name as "igName",
      (select count(*)::int from public.raw_posts rp where rp.source_id = s.id) as posts,
      (select count(distinct ls.listing_id)::int from public.raw_posts rp
        join public.listing_sources ls on ls.raw_post_id = rp.id
        join public.listings l on l.id = ls.listing_id
        where rp.source_id = s.id and l.status = 'active') as listings
    from public.sources s
    where s.type in ('ig_business_account', 'ig_hashtag')
    order by s.type, s.active desc, s.handle`;
}

export interface HashtagBudget {
  used: number;
  max: number;
  entries: { hashtag: string; windowStartedAt: Date; freesAt: Date }[];
}

/** Hashtags counted in Meta's rolling 7-day window (30 unique per account). */
export async function hashtagBudget(sql: Sql): Promise<HashtagBudget> {
  const entries = await sql<{ hashtag: string; windowStartedAt: Date; freesAt: Date }[]>`
    select hashtag, min(window_started_at) as "windowStartedAt",
      min(window_started_at) + interval '7 days' as "freesAt"
    from public.hashtag_budget
    where window_started_at > now() - interval '7 days'
    group by hashtag order by min(window_started_at)`;
  const [setting] = await sql<{ value: unknown }[]>`
    select value from public.app_settings where key = 'hashtag_budget_max'`;
  const max = Number(setting?.value);
  return { used: entries.length, max: Number.isFinite(max) ? max : 25, entries };
}

export const normalizeHashtag = (raw: string): string | null => {
  const tag = raw.trim().replace(/^#/, "").toLowerCase();
  return /^[a-z0-9_]{2,100}$/.test(tag) ? tag : null;
};

export interface AddSourcesResult {
  added: string[];
  existing: string[];
  invalid: string[];
}

/** Adds accounts or hashtags (one per line, comma or space). */
export async function addSources(
  sql: Sql,
  input: { type: SourceType; text: string; actor: string },
): Promise<AddSourcesResult> {
  const result: AddSourcesResult = { added: [], existing: [], invalid: [] };
  const items = input.text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .slice(0, 50);
  const normalize = input.type === "ig_hashtag" ? normalizeHashtag : normalizeUsername;
  await sql.begin(async (tx) => {
    for (const raw of items) {
      const handle = normalize(raw);
      if (!handle) {
        result.invalid.push(raw);
        continue;
      }
      const rows = await tx<{ id: string }[]>`
        insert into public.sources (type, handle, poll_interval_minutes, active)
        values (${input.type}, ${handle}, ${DEFAULT_INTERVAL[input.type]}, true)
        on conflict (type, handle) do nothing returning id`;
      if (!rows[0]) {
        result.existing.push(handle);
        continue;
      }
      result.added.push(handle);
      await tx`
        insert into public.audit_log (actor, action, entity, entity_id, changes)
        values (${input.actor}, 'source.add', 'source', ${rows[0].id},
          ${tx.json({ type: { from: null, to: input.type }, handle: { from: null, to: handle } })})`;
    }
  });
  return result;
}

export async function setSourceActive(
  sql: Sql,
  input: { id: string; active: boolean; actor: string },
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ active: boolean }[]>`
      select active from public.sources where id = ${input.id} for update`;
    if (!row || row.active === input.active) return false;
    await tx`
      update public.sources set active = ${input.active},
        consecutive_failures = case when ${input.active} then 0 else consecutive_failures end
      where id = ${input.id}`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, ${input.active ? "source.resume" : "source.pause"}, 'source', ${input.id},
        ${tx.json({ active: { from: row.active, to: input.active } })})`;
    return true;
  });
}
