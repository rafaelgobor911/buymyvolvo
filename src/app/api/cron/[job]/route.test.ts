import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "a".repeat(40);
const ctx = (job: string) => ({ params: Promise.resolve({ job }) });
const call = (job: string, authorization?: string) =>
  new Request(`http://localhost/api/cron/${job}`, {
    headers: authorization ? { authorization } : {},
  });

describe("/api/cron/[job]", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("refuses to run when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await import("./route");
    const res = await GET(call("token-health", `Bearer ${SECRET}`), ctx("token-health"));
    expect(res.status).toBe(503);
  });

  it("requires the exact bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { GET, POST } = await import("./route");
    expect((await GET(call("token-health"), ctx("token-health"))).status).toBe(401);
    expect((await GET(call("token-health", `Bearer ${SECRET}x`), ctx("token-health"))).status).toBe(
      401,
    );
    expect((await POST(call("token-health", SECRET), ctx("token-health"))).status).toBe(401);
  });

  it("answers 404 for an unknown job", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const { GET } = await import("./route");
    const res = await GET(call("rm-rf", `Bearer ${SECRET}`), ctx("rm-rf"));
    expect(res.status).toBe(404);
  });
});
