import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXTRACTION_MODEL,
  DEFAULT_GRAPH_VERSION,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_URL,
  EnvError,
  parsePublicEnv,
  parseServerEnv,
  requireKeys,
} from "./schema";

describe("parsePublicEnv", () => {
  it("applies defaults when variables are missing or blank", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_SITE_NAME: "", NEXT_PUBLIC_SITE_URL: "  " });
    expect(env.NEXT_PUBLIC_SITE_NAME).toBe(DEFAULT_SITE_NAME);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe(DEFAULT_SITE_URL);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it("strips trailing slashes from the site URL", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "https://example.com.br//" });
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://example.com.br");
  });

  it("rejects an invalid URL", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow(EnvError);
  });
});

describe("parseServerEnv", () => {
  it("applies defaults for model and Graph API version", () => {
    const env = parseServerEnv({});
    expect(env.ANTHROPIC_MODEL_EXTRACTION).toBe(DEFAULT_EXTRACTION_MODEL);
    expect(env.META_GRAPH_VERSION).toBe(DEFAULT_GRAPH_VERSION);
    expect(env.ADMIN_EMAILS).toEqual([]);
  });

  it("splits, trims and lowercases ADMIN_EMAILS", () => {
    const env = parseServerEnv({ ADMIN_EMAILS: " Ana@Example.com, bruno@example.com ,," });
    expect(env.ADMIN_EMAILS).toEqual(["ana@example.com", "bruno@example.com"]);
  });

  it("rejects malformed admin emails", () => {
    expect(() => parseServerEnv({ ADMIN_EMAILS: "ana@example.com, nope" })).toThrow(EnvError);
  });

  it("rejects a Graph API version without the vNN.N format", () => {
    expect(() => parseServerEnv({ META_GRAPH_VERSION: "27" })).toThrow(/META_GRAPH_VERSION/);
  });

  it("rejects short secrets", () => {
    expect(() => parseServerEnv({ HASH_SALT: "short" })).toThrow(/HASH_SALT/);
    expect(() => parseServerEnv({ CRON_SECRET: "x".repeat(31) })).toThrow(/CRON_SECRET/);
    expect(parseServerEnv({ CRON_SECRET: "x".repeat(32) }).CRON_SECRET).toHaveLength(32);
  });
});

describe("requireKeys", () => {
  it("returns the env when all keys are present", () => {
    const env = parseServerEnv({ ANTHROPIC_API_KEY: "sk-test" });
    expect(requireKeys(env, ["ANTHROPIC_API_KEY"]).ANTHROPIC_API_KEY).toBe("sk-test");
  });

  it("lists every missing key in the error", () => {
    const env = parseServerEnv({});
    expect(() => requireKeys(env, ["META_APP_ID", "IG_LONG_LIVED_TOKEN", "ADMIN_EMAILS"])).toThrow(
      "META_APP_ID, IG_LONG_LIVED_TOKEN, ADMIN_EMAILS",
    );
  });
});
