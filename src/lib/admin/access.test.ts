import { describe, expect, it } from "vitest";

import { createTestSession, isAdminEmail, readTestSession, testLoginEmail } from "./access";

const KEY = "unit-test-salt-not-a-secret-00000000000";

describe("admin access", () => {
  it("matches admin e-mails case-insensitively", () => {
    const admins = ["dono@example.com"];
    expect(isAdminEmail("Dono@Example.com ", admins)).toBe(true);
    expect(isAdminEmail("outra@example.com", admins)).toBe(false);
    expect(isAdminEmail(null, admins)).toBe(false);
    expect(isAdminEmail("dono@example.com", [])).toBe(false);
  });

  it("enables the test login only with the variable, demo mode and outside Vercel production", () => {
    const email = "admin.teste@example.com";
    expect(testLoginEmail({ ADMIN_TEST_LOGIN_EMAIL: email, demoMode: true })).toBe(email);
    expect(testLoginEmail({ ADMIN_TEST_LOGIN_EMAIL: email, demoMode: false })).toBeNull();
    expect(
      testLoginEmail({ ADMIN_TEST_LOGIN_EMAIL: email, demoMode: true, VERCEL_ENV: "production" }),
    ).toBeNull();
    expect(testLoginEmail({ demoMode: true })).toBeNull();
  });

  it("signs test sessions and rejects tampered, expired or foreign ones", () => {
    const now = Date.UTC(2026, 10, 9, 12);
    const session = createTestSession(KEY, "admin.teste@example.com", now);
    expect(readTestSession(KEY, session, now + 1000)).toBe("admin.teste@example.com");
    expect(readTestSession(KEY, session, now + 13 * 3600_000)).toBeNull();
    expect(readTestSession("another-key-000000000000000000000000", session, now)).toBeNull();

    const [payload, mac] = session.split(".");
    const forged = Buffer.from(`intruso@example.com|${now + 3600_000}`).toString("base64url");
    expect(readTestSession(KEY, `${forged}.${mac}`, now)).toBeNull();
    expect(readTestSession(KEY, `${payload}.x${mac!.slice(1)}`, now)).toBeNull();
    expect(readTestSession(KEY, undefined, now)).toBeNull();
    expect(readTestSession(KEY, "garbage", now)).toBeNull();
  });
});
