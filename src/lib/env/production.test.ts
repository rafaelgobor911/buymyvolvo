import { describe, expect, it } from "vitest";

import { productionProblems } from "./production";

const good = {
  NEXT_PUBLIC_SITE_URL: "https://buymyvolvo.com.br",
  NEXT_PUBLIC_DEMO_MODE: "false",
  DATABASE_URL: "postgresql://u:p@pooler.example:6543/postgres",
  HASH_SALT: "a".repeat(48),
  CRON_SECRET: "b".repeat(48),
  ADMIN_EMAILS: "dono@example.com",
};

describe("productionProblems", () => {
  it("accepts a complete production setup", () => {
    expect(productionProblems(good)).toEqual([]);
  });

  it("refuses demo mode, test logins, test salts and a missing site URL", () => {
    const problems = productionProblems({
      ...good,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_DEMO_MODE: "true",
      ADMIN_TEST_LOGIN_EMAIL: "admin.teste@example.com",
      HASH_SALT: "e2e-only-salt-not-a-secret-0000000000",
      CRON_SECRET: undefined,
    });
    expect(problems).toEqual([
      "NEXT_PUBLIC_SITE_URL must be the https address of the site (no path).",
      "NEXT_PUBLIC_DEMO_MODE must be off in production.",
      "ADMIN_TEST_LOGIN_EMAIL must not be set in production.",
      "CRON_SECRET is required in production.",
      "HASH_SALT must be a long random value of its own (not a test value).",
    ]);
  });
});
