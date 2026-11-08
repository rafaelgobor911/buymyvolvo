import { describe, expect, it } from "vitest";

import { createTestSession, readTestSession } from "@/lib/admin/access";

import { generateClaimCode, safeNext, testUserId } from "./access";

const KEY = "unit-test-salt-not-a-secret-00000000000";

describe("seller access helpers", () => {
  it("derives a stable uuid for the test login", () => {
    const id = testUserId("vendedor.teste@example.com");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(testUserId("vendedor.teste@example.com")).toBe(id);
    expect(testUserId("outro@example.com")).not.toBe(id);
  });

  it("generates readable claim codes", () => {
    for (let i = 0; i < 200; i++) expect(generateClaimCode()).toMatch(/^RV-[2-9A-HJKMNP-Z]{6}$/);
  });

  it("only follows internal paths after login", () => {
    expect(safeNext("/anuncio/volvo-xc60-d17/reivindicar")).toBe(
      "/anuncio/volvo-xc60-d17/reivindicar",
    );
    expect(safeNext("//evil.example")).toBe("/vendedor");
    expect(safeNext("https://evil.example")).toBe("/vendedor");
    expect(safeNext(undefined)).toBe("/vendedor");
  });

  it("keeps admin and seller test sessions apart", () => {
    const now = Date.UTC(2026, 10, 8, 12);
    const seller = createTestSession(KEY, "vendedor.teste@example.com", now, "seller");
    expect(readTestSession(KEY, seller, now, "seller")).toBe("vendedor.teste@example.com");
    expect(readTestSession(KEY, seller, now, "admin")).toBeNull();
  });
});
