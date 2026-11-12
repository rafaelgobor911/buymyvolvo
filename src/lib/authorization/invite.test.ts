import { describe, expect, it } from "vitest";

import { inviteCode, inviteExpired, inviteMatches, parseInviteCode } from "./invite";

const KEY = "unit-test-salt-not-a-secret-0000000000";
const invite = {
  listingId: "00000000-0000-4000-8000-000000000001",
  shortId: "4245s2",
  invitedAt: new Date("2026-11-16T12:00:00.123Z"),
};

describe("invite links", () => {
  it("signs the listing and the moment of the invite", () => {
    const code = inviteCode(KEY, invite);
    expect(code).toMatch(/^4245s2\.[A-Za-z0-9_-]{22}$/);
    expect(parseInviteCode(code)).toMatchObject({ shortId: "4245s2" });
    expect(inviteMatches(KEY, code, invite)).toBe(true);
  });

  it("a new invite, another listing or another key invalidates the link", () => {
    const code = inviteCode(KEY, invite);
    expect(
      inviteMatches(KEY, code, { ...invite, invitedAt: new Date("2026-11-17T12:00:00Z") }),
    ).toBe(false);
    expect(
      inviteMatches(KEY, code, { ...invite, listingId: "00000000-0000-4000-8000-000000000002" }),
    ).toBe(false);
    expect(inviteMatches(`${KEY}x`, code, invite)).toBe(false);
    expect(inviteMatches(KEY, `${code.slice(0, -1)}A`, invite)).toBe(false);
    expect(inviteMatches(KEY, "4245s2", invite)).toBe(false);
    expect(parseInviteCode("../etc/passwd")).toBeNull();
  });

  it("expires after 30 days", () => {
    const at = invite.invitedAt;
    expect(inviteExpired(at, new Date(at.getTime() + 29 * 86_400_000))).toBe(false);
    expect(inviteExpired(at, new Date(at.getTime() + 30 * 86_400_000))).toBe(true);
  });
});
