/**
 * What a contact click keeps from the HTTP request: salted hashes of IP and
 * user agent (never the raw values), where the click came from and the UTM
 * tags. Also tells real clicks apart from bots, link previews and prefetches.
 */
import { createHmac } from "node:crypto";

/** First address of X-Forwarded-For (set by Vercel and by `next start`), else X-Real-IP. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

/** HMAC-SHA256 with HASH_SALT: stable enough to deduplicate, useless without the salt. */
export function saltedHash(salt: string, value: string | null): string | null {
  if (!value) return null;
  return createHmac("sha256", salt).update(value).digest("hex");
}

/**
 * Crawlers, link previews (WhatsApp, Facebook, Telegram, Slack...), monitors
 * and scripts. In-app browsers (Instagram, Facebook app) are real people and
 * do not match. An empty user agent counts as a bot.
 */
const BOT_UA =
  /bot\/|bot-|bot;|\bbot\b|crawl|spider|slurp|preview|bytespider|facebookexternalhit|facebookcatalog|meta-external|whatsapp\/|telegrambot|slackbot|discordbot|linkedinbot|pinterestbot|embedly|vkshare|quora link|google-inspectiontool|lighthouse|pagespeed|headlesschrome|phantomjs|curl\/|wget\/|python|httpx|aiohttp|axios|node-fetch|undici|go-http-client|java\/|okhttp|libwww|scrapy|uptime|pingdom|statuscake/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent?.trim() || BOT_UA.test(userAgent);
}

/** Speculative loads (browser prefetch/prerender, Next router prefetch) are not clicks. */
export function isPrefetch(headers: Headers): boolean {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""}`;
  return /prefetch|prerender/i.test(purpose) || headers.has("next-router-prefetch");
}

export interface ClickOrigin {
  /** Path of our page that sent the click, or only the origin of an external site. */
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

const clip = (value: string | null | undefined, max = 120) => value?.trim().slice(0, max) || null;

/**
 * Same-origin referrers keep only the path (our own page); external ones only
 * the origin. UTM tags come from the click URL first, then from the page that
 * sent it (a campaign link to the listing page carries them).
 */
export function clickOrigin(requestUrl: string, referer: string | null): ClickOrigin {
  const own = new URL(requestUrl);
  let from: URL | null = null;
  try {
    from = referer ? new URL(referer) : null;
  } catch {
    from = null;
  }
  const sameOrigin = from?.host === own.host;
  const utm = (name: string) =>
    clip(own.searchParams.get(name)) ?? clip(from?.searchParams.get(name));
  return {
    referrer: from ? clip(sameOrigin ? from.pathname : from.origin, 300) : null,
    utmSource: utm("utm_source"),
    utmMedium: utm("utm_medium"),
    utmCampaign: utm("utm_campaign"),
  };
}
