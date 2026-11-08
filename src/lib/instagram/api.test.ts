import { describe, expect, it } from "vitest";

import {
  hashtagId,
  inspectToken,
  normalizeUsername,
  recentHashtagMedia,
  recentlySearchedHashtags,
  scanBusinessAccount,
} from "./api";
import { createFixtureWorld, FIXTURE_IG_USER_ID, fixtureTransport } from "./fixtures";
import { GraphClient } from "./graph";

const NOW = new Date("2026-11-08T12:00:00-03:00");

function setup() {
  const world = createFixtureWorld(NOW);
  const client = new GraphClient({
    token: "fixture-token",
    appId: "fx_app",
    appSecret: "fixture-secret",
    transport: fixtureTransport(world),
    sleep: async () => {},
  });
  return { world, client };
}

describe("normalizeUsername", () => {
  it.each([
    ["@Nordica.Veiculos ", "nordica.veiculos"],
    ["bsl_motors", "bsl_motors"],
    ["https://instagram.com/x", null],
    ["", null],
  ])("%j → %j", (raw, expected) => expect(normalizeUsername(raw)).toBe(expected));
});

describe("scanBusinessAccount", () => {
  it("reads the profile and follows manual cursors across pages", async () => {
    const { client } = setup();
    const scan = await scanBusinessAccount(client, FIXTURE_IG_USER_ID, "nordica.veiculos.demo");
    expect(scan.profile).toMatchObject({
      igId: "fxa_nordica",
      name: "Nórdica Veículos (demo)",
      mediaCount: 26,
    });
    expect(scan.profile.biography).toContain("(20) 3000-0100");
    expect(scan.media).toHaveLength(26);
    expect(new Set(scan.media.map((m) => m.id)).size).toBe(26);
    expect(scan.reachedEnd).toBe(true);
    expect(scan.media[0]!.permalink).toMatch(/FIXTURE_/);
  });

  it("stops at the page limit and says there is more", async () => {
    const { client } = setup();
    const scan = await scanBusinessAccount(client, FIXTURE_IG_USER_ID, "nordica.veiculos.demo", {
      pages: 1,
    });
    expect(scan.media).toHaveLength(25);
    expect(scan.reachedEnd).toBe(false);
  });

  it("reports a personal or missing account as not_found", async () => {
    const { client } = setup();
    await expect(
      scanBusinessAccount(client, FIXTURE_IG_USER_ID, "perfil.pessoal.demo"),
    ).rejects.toMatchObject({ kind: "not_found", details: { code: 110, subcode: 2207013 } });
  });

  it("retries a transient failure", async () => {
    const { world, client } = setup();
    world.failures.push({
      match: "username(fiorde.motors.demo)",
      status: 500,
      error: { message: "An unexpected error has occurred.", code: 2, is_transient: true },
      times: 1,
    });
    const scan = await scanBusinessAccount(client, FIXTURE_IG_USER_ID, "fiorde.motors.demo");
    expect(scan.media).toHaveLength(5);
  });
});

describe("hashtags", () => {
  it("looks up IDs, reads the last 24 hours and records the searches", async () => {
    const { world, client } = setup();
    const id = await hashtagId(client, FIXTURE_IG_USER_ID, "volvoseminovo_demo");
    expect(id).toBe("fxh_volvoseminovo");
    const media = await recentHashtagMedia(client, FIXTURE_IG_USER_ID, id!);
    expect(media.map((m) => m.id)).toEqual(["fxm_tag_05"]);
    expect(await hashtagId(client, FIXTURE_IG_USER_ID, "naoexiste")).toBeNull();
    expect(await recentlySearchedHashtags(client, FIXTURE_IG_USER_ID)).toEqual(world.searched);
  });

  it("stops when the cursor comes back unchanged", async () => {
    const { world, client } = setup();
    world.repeatHashtagCursor = true;
    const media = await recentHashtagMedia(client, FIXTURE_IG_USER_ID, "fxh_volvoavenda", {
      pages: 10,
    });
    expect(media).toHaveLength(4);
    expect(world.calls).toBeLessThanOrEqual(2);
  });
});

describe("inspectToken", () => {
  it("returns validity, expiry and scopes", async () => {
    const { client } = setup();
    const info = await inspectToken(client, "fixture-token");
    expect(info.valid).toBe(true);
    expect(Math.round((info.expiresAt!.getTime() - NOW.getTime()) / 86_400_000)).toBe(50);
    expect(info.scopes).toContain("instagram_manage_insights");
  });
});
