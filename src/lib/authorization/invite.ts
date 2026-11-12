/**
 * The seller's invite link: `/autorizar/<short_id>.<signature>`. Pure.
 *
 * The signature is an HMAC (HASH_SALT) over the listing and the moment the
 * invite was created, so nothing secret is stored and the admin can show the
 * link again at any time; a new invite changes `invited_at` and invalidates
 * the previous link. Links expire after INVITE_VALID_DAYS.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITE_VALID_DAYS = 30;

const CODE = /^([a-z0-9]{2,12})\.([A-Za-z0-9_-]{22})$/;

const sign = (key: string, listingId: string, invitedAt: Date) =>
  createHmac("sha256", `seller-invite:${key}`)
    .update(`${listingId}|${invitedAt.getTime()}`)
    .digest("base64url")
    .slice(0, 22);

export function inviteCode(
  key: string,
  invite: { listingId: string; shortId: string; invitedAt: Date },
): string {
  return `${invite.shortId}.${sign(key, invite.listingId, invite.invitedAt)}`;
}

export function parseInviteCode(code: string): { shortId: string; mac: string } | null {
  const match = CODE.exec(code);
  return match ? { shortId: match[1]!, mac: match[2]! } : null;
}

export function inviteMatches(
  key: string,
  code: string,
  invite: { listingId: string; invitedAt: Date },
): boolean {
  const parsed = parseInviteCode(code);
  if (!parsed) return false;
  const expected = Buffer.from(sign(key, invite.listingId, invite.invitedAt));
  const given = Buffer.from(parsed.mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const inviteExpiresAt = (invitedAt: Date) =>
  new Date(invitedAt.getTime() + INVITE_VALID_DAYS * 86_400_000);

export const inviteExpired = (invitedAt: Date, now: Date) =>
  inviteExpiresAt(invitedAt).getTime() <= now.getTime();
