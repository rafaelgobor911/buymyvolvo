/**
 * Cookie consent (LGPD). The choice lives in the visitor's browser
 * (localStorage, an essential item); nothing about it reaches our server.
 * Pure helpers on top, browser store below (always guarded).
 *
 * Basic Consent Mode: Google's tag is not even loaded before a choice that
 * allows it. A stored choice is valid only for the same version key: bump
 * CONSENT_VERSION when the purposes change; turning on a new category (Google
 * Ads) changes the key by itself, so everyone is asked again.
 */
export const CONSENT_VERSION = 1;

/** "1:analytics" or "1:analytics+ads", depending on the tags configured. */
export const consentVersionKey = (categories: { ads: boolean }) =>
  `${CONSENT_VERSION}:${categories.ads ? "analytics+ads" : "analytics"}`;
export const CONSENT_STORAGE_KEY = "bmv-consent";
const CHANGE_EVENT = "bmv:consent-change";
const OPEN_EVENT = "bmv:consent-open";

export interface ConsentChoice {
  /** Measurement (Google Analytics). */
  analytics: boolean;
  /** Advertising (Google Ads conversions and, later, remarketing). */
  ads: boolean;
}

interface StoredConsent extends ConsentChoice {
  v: string;
  /** When the choice was made (ISO), to show and to renew. */
  at: string;
}

export function parseConsent(
  raw: string | null | undefined,
  version: string,
): ConsentChoice | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<StoredConsent>;
    if (data.v !== version) return null;
    if (typeof data.analytics !== "boolean" || typeof data.ads !== "boolean") return null;
    return { analytics: data.analytics, ads: data.ads };
  } catch {
    return null;
  }
}

export const serializeConsent = (choice: ConsentChoice, version: string, now = new Date()) =>
  JSON.stringify({
    v: version,
    analytics: choice.analytics,
    ads: choice.ads,
    at: now.toISOString(),
  } satisfies StoredConsent);

type Signal = "granted" | "denied";

/** The four Consent Mode v2 signals for a choice (no choice = everything denied). */
export function consentSignals(choice: ConsentChoice | null): {
  analytics_storage: Signal;
  ad_storage: Signal;
  ad_user_data: Signal;
  ad_personalization: Signal;
} {
  const g = (on: boolean | undefined): Signal => (on ? "granted" : "denied");
  return {
    analytics_storage: g(choice?.analytics),
    ad_storage: g(choice?.ads),
    ad_user_data: g(choice?.ads),
    ad_personalization: g(choice?.ads),
  };
}

// ---------------------------------------------------------------------------
// Browser store
// ---------------------------------------------------------------------------

/** Fallback when storage is blocked: the choice holds until the page reloads. */
let inMemory: string | null = null;

/** Raw stored value (a string, so useSyncExternalStore gets a stable snapshot). */
export function readStoredConsent(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY) ?? inMemory;
  } catch {
    return inMemory;
  }
}

export function saveConsent(choice: ConsentChoice, version: string) {
  inMemory = serializeConsent(choice, version);
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, inMemory);
  } catch {
    // Private mode or blocked storage: kept in memory only.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: choice }));
}

export function subscribeConsent(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CONSENT_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reopens the preferences panel (footer link). */
export const openConsentPreferences = () => window.dispatchEvent(new Event(OPEN_EVENT));

export function onConsentOpen(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}
