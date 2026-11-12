/**
 * Upload token for the photos of a listing just sent by the public form: the
 * browser gets it in the form's answer and sends one photo per request with
 * it. HMAC (HASH_SALT) over the listing and an expiry; nothing is stored.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const PHOTO_TOKEN_HOURS = 2;

const sign = (key: string, listingId: string, expires: number) =>
  createHmac("sha256", `listing-photos:${key}`)
    .update(`${listingId}|${expires}`)
    .digest("base64url");

/** `<expires ms>.<signature>` */
export function photoUploadToken(key: string, listingId: string, now = Date.now()): string {
  const expires = now + PHOTO_TOKEN_HOURS * 3600_000;
  return `${expires}.${sign(key, listingId, expires)}`;
}

export function photoTokenValid(
  key: string,
  listingId: string,
  token: string,
  now = Date.now(),
): boolean {
  const [rawExpires, mac] = token.split(".");
  const expires = Number(rawExpires);
  if (!mac || !Number.isSafeInteger(expires) || expires <= now) return false;
  const expected = Buffer.from(sign(key, listingId, expires));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
