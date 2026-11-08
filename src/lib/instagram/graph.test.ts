import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  classifyError,
  GraphClient,
  GraphError,
  type GraphRequest,
  type GraphResponse,
  readUsage,
  usagePercent,
} from "./graph";

const Any = z.object({ ok: z.boolean() });

function scripted(responses: Array<Partial<GraphResponse> | Error>) {
  const requests: GraphRequest[] = [];
  const transport = vi.fn(async (req: GraphRequest): Promise<GraphResponse> => {
    requests.push(req);
    const next = responses.shift();
    if (!next) throw new Error("no more scripted responses");
    if (next instanceof Error) throw next;
    return { status: 200, body: { ok: true }, headers: new Headers(), ...next };
  });
  return { transport, requests };
}

const metaError = (status: number, code: number, extra: Record<string, unknown> = {}) => ({
  status,
  body: { error: { message: `error ${code}`, type: "OAuthException", code, ...extra } },
});

describe("classifyError", () => {
  it.each([
    [400, { code: 4 }, "rate_limit"],
    [400, { code: 17 }, "rate_limit"],
    [400, { code: 32 }, "rate_limit"],
    [400, { code: 613 }, "rate_limit"],
    [400, { code: 80002 }, "rate_limit"],
    [400, { code: 190 }, "auth"],
    [400, { code: 110, error_subcode: 2207013 }, "not_found"],
    [400, { code: 100, error_subcode: 33 }, "not_found"],
    [403, { code: 10 }, "permission"],
    [403, { code: 200 }, "permission"],
    [500, { code: 2, is_transient: true }, "transient"],
    [500, undefined, "transient"],
    [400, { code: 100 }, "invalid_request"],
  ] as const)("HTTP %s %j → %s", (status, error, kind) => {
    expect(classifyError(status, error)).toBe(kind);
  });
});

describe("GraphClient", () => {
  it("sends the token in the Authorization header and an appsecret_proof", async () => {
    const { transport, requests } = scripted([{}]);
    const client = new GraphClient({ token: "user-token", appSecret: "s3cret", transport });
    await client.get("123", { fields: "id" }, Any);
    const [req] = requests;
    expect(req!.headers.Authorization).toBe("Bearer user-token");
    expect(JSON.stringify(req!.params)).not.toContain("user-token");
    expect(req!.params.appsecret_proof).toBe(
      createHmac("sha256", "s3cret").update("user-token").digest("hex"),
    );
  });

  it("calls with the app token only when app credentials are configured", async () => {
    const { transport, requests } = scripted([{}]);
    const client = new GraphClient({ token: "t", appId: "1", appSecret: "s", transport });
    await client.getAsApp("debug_token", { input_token: "t" }, Any);
    expect(requests[0]!.headers.Authorization).toBe("Bearer 1|s");
    expect(requests[0]!.params.appsecret_proof).toBeUndefined();
    const bare = new GraphClient({ token: "t", transport });
    await expect(bare.getAsApp("debug_token", {}, Any)).rejects.toThrow(/META_APP_ID/);
  });

  it("retries transient errors and network failures with exponential backoff", async () => {
    const { transport } = scripted([
      metaError(500, 2, { is_transient: true }),
      new Error("ECONNRESET"),
      {},
    ]);
    const sleep = vi.fn(async () => {});
    const client = new GraphClient({ token: "t", transport, sleep, backoffMs: 100 });
    await expect(client.get("x", {}, Any)).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledTimes(2);
    const [first, second] = sleep.mock.calls.map((c) => (c as unknown as [number])[0]);
    expect(first).toBeGreaterThanOrEqual(80);
    expect(first).toBeLessThanOrEqual(120);
    expect(second).toBeGreaterThanOrEqual(160);
    expect(second).toBeLessThanOrEqual(240);
  });

  it("backs off longer on rate limits and gives up after maxRetries", async () => {
    const { transport } = scripted([metaError(400, 4), metaError(400, 4), metaError(400, 4)]);
    const sleep = vi.fn(async () => {});
    const client = new GraphClient({ token: "t", transport, sleep, backoffMs: 100, maxRetries: 2 });
    const error = await client.get("x", {}, Any).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GraphError);
    expect((error as GraphError).kind).toBe("rate_limit");
    expect(transport).toHaveBeenCalledTimes(3);
    expect((sleep.mock.calls[0] as unknown as [number])[0]).toBeGreaterThanOrEqual(400);
  });

  it("fails fast on errors that a retry cannot fix", async () => {
    const { transport } = scripted([metaError(400, 190)]);
    const sleep = vi.fn(async () => {});
    const client = new GraphClient({ token: "t", transport, sleep });
    await expect(client.get("x", {}, Any)).rejects.toMatchObject({
      kind: "auth",
      details: { code: 190 },
    });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("rejects a response that does not match the schema", async () => {
    const { transport } = scripted([{ body: { unexpected: 1 } }]);
    const client = new GraphClient({ token: "t", transport });
    await expect(client.get("x", {}, Any)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("keeps the last usage headers and reports when near the limit", async () => {
    const { transport } = scripted([
      {
        headers: new Headers({
          "x-app-usage": JSON.stringify({ call_count: 12, total_cputime: 3, total_time: 5 }),
          "x-business-use-case-usage": JSON.stringify({
            "17841": [{ type: "instagram", call_count: 95, total_cputime: 1, total_time: 1 }],
          }),
        }),
      },
    ]);
    const client = new GraphClient({ token: "t", transport });
    await client.get("x", {}, Any);
    expect(usagePercent(client.lastUsage)).toBe(95);
    expect(client.nearLimit(90)).toBe(true);
    expect(client.nearLimit(96)).toBe(false);
  });
});

describe("readUsage", () => {
  it("ignores missing or malformed headers", () => {
    const usage = readUsage(new Headers({ "x-app-usage": "not json" }));
    expect(usage.app).toBeUndefined();
    expect(usagePercent(usage)).toBe(0);
  });
});
