/**
 * Where a listing's car is, when the post itself does not say. Pure.
 *
 * Order: what the post (or the account bio) says, read by the extraction >
 * the shop's default location set by the admin (Fontes) > the state of the
 * phone's area code (DDD), flagged so the page can say it is an estimate.
 * A DDD belongs to a single state, but not to a single city, and people keep
 * their number when they move: only the state, never the city.
 */
import type { Uf } from "@/lib/search/places";

/** Every Brazilian area code (Anatel) and its state. Mirrored by public.uf_from_phone() in SQL. */
export const UF_BY_DDD: Readonly<Record<number, Uf>> = {
  11: "SP",
  12: "SP",
  13: "SP",
  14: "SP",
  15: "SP",
  16: "SP",
  17: "SP",
  18: "SP",
  19: "SP",
  21: "RJ",
  22: "RJ",
  24: "RJ",
  27: "ES",
  28: "ES",
  31: "MG",
  32: "MG",
  33: "MG",
  34: "MG",
  35: "MG",
  37: "MG",
  38: "MG",
  41: "PR",
  42: "PR",
  43: "PR",
  44: "PR",
  45: "PR",
  46: "PR",
  47: "SC",
  48: "SC",
  49: "SC",
  51: "RS",
  53: "RS",
  54: "RS",
  55: "RS",
  61: "DF",
  62: "GO",
  64: "GO",
  63: "TO",
  65: "MT",
  66: "MT",
  67: "MS",
  68: "AC",
  69: "RO",
  71: "BA",
  73: "BA",
  74: "BA",
  75: "BA",
  77: "BA",
  79: "SE",
  81: "PE",
  87: "PE",
  82: "AL",
  83: "PB",
  84: "RN",
  85: "CE",
  88: "CE",
  86: "PI",
  89: "PI",
  91: "PA",
  93: "PA",
  94: "PA",
  92: "AM",
  97: "AM",
  95: "RR",
  96: "AP",
  98: "MA",
  99: "MA",
};

/** State of a Brazilian E.164 number ("+5511…" → "SP"), or null. */
export function ufFromPhone(e164: string | null | undefined): Uf | null {
  const match = e164 ? /^\+55(\d{2})\d{8,9}$/.exec(e164) : null;
  return match ? (UF_BY_DDD[Number(match[1])] ?? null) : null;
}

export interface Place {
  city: string | null;
  uf: string | null;
  /** The state was inferred from the phone's area code (shown as an estimate). */
  ufFromDdd: boolean;
}

export function fillLocation(
  found: { city: string | null; uf: string | null },
  fallback: { sourceCity?: string | null; sourceUf?: string | null; phone?: string | null },
): Place {
  if (found.city || found.uf) return { city: found.city, uf: found.uf, ufFromDdd: false };
  if (fallback.sourceUf) {
    return { city: fallback.sourceCity ?? null, uf: fallback.sourceUf, ufFromDdd: false };
  }
  const uf = ufFromPhone(fallback.phone);
  return uf ? { city: null, uf, ufFromDdd: true } : { city: null, uf: null, ufFromDdd: false };
}
