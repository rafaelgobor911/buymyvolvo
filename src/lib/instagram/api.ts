/**
 * Typed wrappers for the three Graph API features we use. Field lists are
 * minimal on purpose: no media_url (we never store third-party images) and no
 * engagement metrics.
 */
import { z } from "zod";

import { type GraphClient, GraphError } from "./graph";

const MEDIA_FIELDS = "id,caption,media_type,permalink,timestamp";

const Media = z.object({
  id: z.string(),
  caption: z.string().optional(),
  media_type: z.string().optional(),
  permalink: z.string(),
  timestamp: z.string(),
});
export type IgMedia = z.infer<typeof Media>;

const Paging = z
  .object({
    cursors: z.object({ before: z.string().optional(), after: z.string().optional() }).optional(),
    next: z.string().optional(),
  })
  .optional();

/** Instagram media types we store; anything else is kept as null. */
export function mediaType(value: string | undefined): "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | null {
  return value === "IMAGE" || value === "VIDEO" || value === "CAROUSEL_ALBUM" ? value : null;
}

export const USERNAME = /^[a-z0-9._]{1,30}$/;

/** "@Loja.X " → "loja.x"; null when it is not a valid Instagram username. */
export function normalizeUsername(raw: string): string | null {
  const u = raw.trim().replace(/^@/, "").toLowerCase();
  return USERNAME.test(u) ? u : null;
}

// ---------------------------------------------------------------------------
// Business Discovery
// ---------------------------------------------------------------------------

const BusinessDiscovery = z.object({
  business_discovery: z.object({
    id: z.string(),
    username: z.string().optional(),
    name: z.string().optional(),
    biography: z.string().optional(),
    website: z.string().optional(),
    media_count: z.number().optional(),
    media: z.object({ data: z.array(Media), paging: Paging }).optional(),
  }),
});

export interface AccountScan {
  profile: {
    igId: string;
    username: string;
    name: string | null;
    biography: string | null;
    website: string | null;
    mediaCount: number | null;
  };
  /** Newest first, as returned by the API. */
  media: IgMedia[];
  /** True when the account has no more posts beyond what was read. */
  reachedEnd: boolean;
}

/**
 * Reads the profile and the latest posts of a professional account. The API
 * gives cursors but no `next` link, so later pages are requested with
 * `media.after(cursor)`.
 */
export async function scanBusinessAccount(
  client: GraphClient,
  igUserId: string,
  username: string,
  options: { pages?: number; perPage?: number } = {},
): Promise<AccountScan> {
  const pages = options.pages ?? 2;
  const perPage = options.perPage ?? 25;
  const media: IgMedia[] = [];
  let profile: AccountScan["profile"] | null = null;
  let after: string | undefined;
  let reachedEnd = false;

  for (let page = 0; page < pages; page++) {
    const mediaEdge = `media${after ? `.after(${after})` : ""}.limit(${perPage}){${MEDIA_FIELDS}}`;
    const profileFields = page === 0 ? "username,name,biography,website,media_count," : "";
    const res = await client.get(
      igUserId,
      { fields: `business_discovery.username(${username}){${profileFields}${mediaEdge}}` },
      BusinessDiscovery,
    );
    const bd = res.business_discovery;
    profile ??= {
      igId: bd.id,
      username: bd.username ?? username,
      name: bd.name ?? null,
      biography: bd.biography ?? null,
      website: bd.website ?? null,
      mediaCount: bd.media_count ?? null,
    };
    const data = bd.media?.data ?? [];
    const fresh = data.filter((m) => !media.some((seen) => seen.id === m.id));
    media.push(...fresh);
    const next = bd.media?.paging?.cursors?.after;
    if (data.length < perPage || fresh.length === 0 || !next || next === after) {
      reachedEnd = true;
      break;
    }
    after = next;
  }
  return { profile: profile!, media, reachedEnd };
}

// ---------------------------------------------------------------------------
// Hashtag Search
// ---------------------------------------------------------------------------

const IdList = z.object({ data: z.array(z.object({ id: z.string() })), paging: Paging });

/** Looks up a hashtag ID. Counts against the 30-hashtags-per-7-days limit. */
export async function hashtagId(
  client: GraphClient,
  igUserId: string,
  hashtag: string,
): Promise<string | null> {
  const res = await client.get("ig_hashtag_search", { user_id: igUserId, q: hashtag }, IdList);
  return res.data[0]?.id ?? null;
}

const MediaPage = z.object({ data: z.array(Media), paging: Paging });

/**
 * Posts from the last 24 hours with the hashtag (no username, no boosted
 * posts). Guards against the cursor coming back unchanged and against pages
 * that only repeat posts already read.
 */
export async function recentHashtagMedia(
  client: GraphClient,
  igUserId: string,
  hashtagIgId: string,
  options: { pages?: number } = {},
): Promise<IgMedia[]> {
  const pages = options.pages ?? 4;
  const media: IgMedia[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;
  for (let page = 0; page < pages; page++) {
    const params: Record<string, string> = {
      user_id: igUserId,
      fields: MEDIA_FIELDS,
      limit: "50",
    };
    if (after) params.after = after;
    const res = await client.get(`${hashtagIgId}/recent_media`, params, MediaPage);
    const fresh = res.data.filter((m) => !media.some((seen) => seen.id === m.id));
    media.push(...fresh);
    const next = res.paging?.cursors?.after;
    if (fresh.length === 0 || !next || seenCursors.has(next)) break;
    seenCursors.add(next);
    after = next;
  }
  return media;
}

/** Hashtag IDs this account queried in the current rolling 7-day window. */
export async function recentlySearchedHashtags(
  client: GraphClient,
  igUserId: string,
): Promise<string[]> {
  const res = await client.get(`${igUserId}/recently_searched_hashtags`, { limit: "30" }, IdList);
  return res.data.map((h) => h.id);
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

const DebugToken = z.object({
  data: z.object({
    is_valid: z.boolean(),
    type: z.string().optional(),
    app_id: z.string().optional(),
    application: z.string().optional(),
    expires_at: z.number().optional(),
    data_access_expires_at: z.number().optional(),
    scopes: z.array(z.string()).optional(),
    error: z.object({ message: z.string().optional(), code: z.number().optional() }).optional(),
  }),
});

export interface TokenInfo {
  valid: boolean;
  type: string | null;
  appId: string | null;
  /** null = does not expire (e.g. some System User tokens). */
  expiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
  scopes: string[];
  error: string | null;
}

const fromUnix = (s: number | undefined) => (s ? new Date(s * 1000) : null);

/** Inspects the configured user token with the app token. */
export async function inspectToken(client: GraphClient, token: string): Promise<TokenInfo> {
  const { data } = await client.getAsApp("debug_token", { input_token: token }, DebugToken);
  return {
    valid: data.is_valid,
    type: data.type ?? null,
    appId: data.app_id ?? null,
    expiresAt: fromUnix(data.expires_at),
    dataAccessExpiresAt: fromUnix(data.data_access_expires_at),
    scopes: data.scopes ?? [],
    error: data.error?.message ?? null,
  };
}

/** Permissions Business Discovery and Hashtag Search need. */
export const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
  "pages_read_engagement",
] as const;

export { GraphError };
