import { describe, expect, it } from "vitest";

import { photoTokenValid, photoUploadToken } from "./photo-token";

const KEY = "unit-test-salt-not-a-secret-0000000000";
const ID = "00000000-0000-4000-8000-000000000001";

describe("photo upload token", () => {
  it("is valid for its listing for two hours", () => {
    const now = Date.UTC(2026, 10, 18, 12);
    const token = photoUploadToken(KEY, ID, now);
    expect(photoTokenValid(KEY, ID, token, now + 3600_000)).toBe(true);
    expect(photoTokenValid(KEY, ID, token, now + 2 * 3600_000)).toBe(false);
    expect(photoTokenValid(KEY, "00000000-0000-4000-8000-000000000002", token, now)).toBe(false);
    expect(photoTokenValid(`${KEY}x`, ID, token, now)).toBe(false);
    const [expires, mac] = token.split(".");
    expect(photoTokenValid(KEY, ID, `${Number(expires) + 3600_000}.${mac}`, now)).toBe(false);
    expect(photoTokenValid(KEY, ID, "lixo", now)).toBe(false);
  });
});
