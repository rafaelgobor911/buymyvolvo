/**
 * Pure rules for admin access: who is an admin, when the test login exists,
 * and the signed cookie of a test session. No I/O, no env reads.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface Admin {
  email: string;
  via: "supabase" | "test";
}

export const isAdminEmail = (email: string | null | undefined, adminEmails: string[]) =>
  !!email && adminEmails.includes(email.trim().toLowerCase());

/**
 * The test login (no Google) is for e2e tests and screenshots only. It needs
 * the variable, demo mode on and must not be a Vercel production deployment.
 */
export function testLoginEmail(env: {
  ADMIN_TEST_LOGIN_EMAIL?: string;
  VERCEL_ENV?: string;
  demoMode: boolean;
}): string | null {
  if (!env.ADMIN_TEST_LOGIN_EMAIL || !env.demoMode || env.VERCEL_ENV === "production") return null;
  return env.ADMIN_TEST_LOGIN_EMAIL;
}

export const TEST_SESSION_COOKIE = "bmv_admin_test";
export const TEST_SESSION_HOURS = 12;

/** Admin and seller test sessions are signed apart, so one cannot be used as the other. */
export type TestSessionScope = "admin" | "seller";

const sign = (key: string, payload: string, scope: TestSessionScope) =>
  createHmac("sha256", `${scope}-test-session:${key}`).update(payload).digest("base64url");

/** `<base64url(email|expiresAt)>.<hmac>`, signed with HASH_SALT. */
export function createTestSession(
  key: string,
  email: string,
  now = Date.now(),
  scope: TestSessionScope = "admin",
): string {
  const payload = Buffer.from(`${email}|${now + TEST_SESSION_HOURS * 3600_000}`).toString(
    "base64url",
  );
  return `${payload}.${sign(key, payload, scope)}`;
}

export function readTestSession(
  key: string,
  value: string | undefined,
  now = Date.now(),
  scope: TestSessionScope = "admin",
) {
  if (!value) return null;
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(key, payload, scope));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [email, expires] = Buffer.from(payload, "base64url").toString().split("|");
  if (!email || !(Number(expires) > now)) return null;
  return email;
}
