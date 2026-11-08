/** Pure helpers for seller access and claims. No I/O, no env. */
import { createHash, randomInt } from "node:crypto";

export const SELLER_TEST_COOKIE = "bmv_seller_test";

/**
 * The test login has no Supabase user: give it a stable uuid derived from the
 * e-mail, so its seller profile is found again on the next login.
 */
export function testUserId(email: string): string {
  const h = createHash("sha256").update(`seller-test:${email}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Same readable alphabet as the lead codes (no 0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Code the seller sends from the listing's own Instagram to prove ownership. */
export function generateClaimCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `RV-${code}`;
}

/** Internal redirect target after login; anything else falls back to the panel. */
export function safeNext(raw: unknown, fallback = "/vendedor"): string {
  return typeof raw === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(raw) ? raw : fallback;
}
