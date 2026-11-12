/**
 * Google tag (gtag.js) for GA4 and Google Ads, loaded only after consent.
 * Browser-only; every function is a no-op until the tag is set up.
 */
import { type ConsentChoice, consentSignals } from "@/lib/analytics/consent";

export interface GoogleTagConfig {
  gaId?: string;
  adsId?: string;
  /** Google Ads conversion label for a contact click. */
  leadLabel?: string;
}

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let config: GoogleTagConfig = {};
let current: ConsentChoice | null = null;
let decided = false;
const configured = new Set<string>();
/** Events fired before the visitor decided; sent only if they then allow it. */
let pending: Array<[string, EventParams]> = [];

/**
 * Addresses that work as a credential (the seller's invite link): the Google
 * tag never loads there, so the address is never sent to Google.
 */
export const isUntrackedPath = (pathname: string | null) =>
  !!pathname && pathname.startsWith("/autorizar/");

const allowsAny = (c: ConsentChoice | null) => !!c && (c.analytics || c.ads);

/** Sets up the tag for this choice: loads gtag.js the first time something is allowed. */
export function applyConsent(next: ConsentChoice, cfg: GoogleTagConfig) {
  config = cfg;
  current = next;
  decided = true;
  const queued = pending;
  pending = [];
  if (!window.gtag) {
    if (!allowsAny(next)) return;
    window.dataLayer = window.dataLayer ?? [];
    // gtag.js reads `arguments` objects from the dataLayer.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("consent", "default", consentSignals(null));
    window.gtag("js", new Date());
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      (cfg.gaId ?? cfg.adsId)!,
    )}`;
    document.head.appendChild(script);
  }
  window.gtag("consent", "update", consentSignals(next));
  // Each product is configured only once its own category is allowed.
  if (next.analytics && cfg.gaId && !configured.has(cfg.gaId)) {
    configured.add(cfg.gaId);
    window.gtag("config", cfg.gaId);
  }
  if (next.ads && cfg.adsId && !configured.has(cfg.adsId)) {
    configured.add(cfg.adsId);
    window.gtag("config", cfg.adsId);
  }
  if (!next.analytics || !next.ads) clearGoogleCookies(next);
  for (const [event, params] of queued) track(event, params);
}

/** Removes cookies of a category the visitor turned off. */
function clearGoogleCookies(choice: ConsentChoice) {
  const prefixes = [...(choice.analytics ? [] : ["_ga"]), ...(choice.ads ? [] : ["_gcl"])];
  if (!prefixes.length) return;
  const host = window.location.hostname;
  const domains = ["", host, `.${host.split(".").slice(-3).join(".")}`];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]!.trim();
    if (!prefixes.some((p) => name.startsWith(p))) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

export type EventParams = Record<string, string | number | boolean | undefined | unknown[]>;

/** Sends an event if the visitor allowed measurement or advertising. */
export function track(event: string, params: EventParams = {}) {
  if (!decided) {
    if (pending.length < 20) pending.push([event, params]);
    return;
  }
  if (!window.gtag || !allowsAny(current)) return;
  window.gtag("event", event, params);
  if (event === "generate_lead" && current?.ads && config.adsId && config.leadLabel) {
    window.gtag("event", "conversion", { send_to: `${config.adsId}/${config.leadLabel}` });
  }
}
