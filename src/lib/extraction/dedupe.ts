/**
 * The same car is often posted several times (same account, several accounts,
 * reposts). A listing is one car; each post becomes a listing_source.
 *
 * 1. Exact: dedupe_key = hash(model, engine, model year, km rounded to 5,000, contact).
 * 2. Fuzzy: same model, year and contact, and km within 3,000 (or similar text
 *    when the mileage is unknown).
 */
import { createHash } from "node:crypto";

import type { NormalizedListing } from "./normalize";
import { trigramSimilarity } from "./text";

const KM_BUCKET = 5_000;

export function dedupeKey(n: NormalizedListing): string | null {
  const contact = n.contactPhone ?? (n.contactIgUsername ? `@${n.contactIgUsername}` : null);
  if (!n.modelId || !n.yearModel || !contact) return null;
  const km = n.km == null ? "" : String(Math.round(n.km / KM_BUCKET));
  const raw = [n.modelId, n.engineId ?? "", n.yearModel, km, contact].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export interface DedupeCandidate {
  modelId: string;
  yearModel: number | null;
  km: number | null;
  contactPhone: string | null;
  contactIgUsername: string | null;
  text: string;
}

export function isLikelySameCar(a: DedupeCandidate, b: DedupeCandidate): boolean {
  if (a.modelId !== b.modelId || a.yearModel !== b.yearModel) return false;
  const sameContact =
    (a.contactPhone && a.contactPhone === b.contactPhone) ||
    (a.contactIgUsername && a.contactIgUsername === b.contactIgUsername);
  if (!sameContact) return false;
  // Same seller, model and year: mileage tells two cars apart (a dealer may have
  // several XC60 2020); without mileage on both sides, the text has to match.
  if (a.km != null && b.km != null) return Math.abs(a.km - b.km) <= 3_000;
  if (!a.text.trim() || !b.text.trim()) return false;
  return trigramSimilarity(a.text, b.text) >= 0.3;
}
