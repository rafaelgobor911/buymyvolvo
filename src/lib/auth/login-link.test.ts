import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};
let configured = true;

vi.mock("@/lib/admin/supabase", () => ({
  supabaseConfigured: () => configured,
  supabaseServer: async () => ({ auth }),
}));
vi.mock("@/lib/env/server", () => ({
  serverEnv: () => ({ ADMIN_EMAILS: ["dono@example.com"] }),
}));
vi.mock("@/lib/site", () => ({ site: { url: "https://buymyvolvo.com.br" } }));

const { completeSupabaseLogin, sendLoginLink } = await import("./login-link");

beforeEach(() => {
  configured = true;
  auth.signInWithOtp.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("sendLoginLink", () => {
  it("sends the admin link only to ADMIN_EMAILS, answering the same to everyone", async () => {
    expect(await sendLoginLink({ email: " Dono@Example.com ", scope: "admin" })).toEqual({
      ok: true,
    });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "dono@example.com",
      options: {
        emailRedirectTo: "https://buymyvolvo.com.br/admin/auth/callback?next=%2Fadmin",
        shouldCreateUser: true,
      },
    });
    auth.signInWithOtp.mockClear();
    expect(await sendLoginLink({ email: "intruso@example.com", scope: "admin" })).toEqual({
      ok: true,
    });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("sellers get a link back to where they were", async () => {
    await sendLoginLink({ email: "loja@example.com", scope: "seller", next: "/vendedor" });
    expect(auth.signInWithOtp.mock.calls[0]![0].options.emailRedirectTo).toBe(
      "https://buymyvolvo.com.br/auth/callback?next=%2Fvendedor",
    );
  });

  it("explains bad input, rate limits and a missing Supabase project", async () => {
    expect(await sendLoginLink({ email: "não é e-mail", scope: "seller" })).toEqual({
      ok: false,
      error: "email",
    });
    auth.signInWithOtp.mockResolvedValue({ error: { status: 429 } });
    expect(await sendLoginLink({ email: "loja@example.com", scope: "seller" })).toEqual({
      ok: false,
      error: "limite",
    });
    configured = false;
    expect(await sendLoginLink({ email: "loja@example.com", scope: "seller" })).toEqual({
      ok: false,
      error: "indisponivel",
    });
  });
});

describe("completeSupabaseLogin", () => {
  it("accepts the token_hash link and the PKCE code", async () => {
    expect(
      await completeSupabaseLogin(new URLSearchParams("token_hash=abc&type=magiclink")),
    ).toBe(true);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "magiclink" });
    expect(await completeSupabaseLogin(new URLSearchParams("code=xyz"))).toBe(true);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  });

  it("rejects missing, unknown or failed tokens", async () => {
    expect(await completeSupabaseLogin(new URLSearchParams(""))).toBe(false);
    expect(await completeSupabaseLogin(new URLSearchParams("token_hash=a&type=recovery"))).toBe(
      false,
    );
    auth.verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    expect(
      await completeSupabaseLogin(new URLSearchParams("token_hash=abc&type=magiclink")),
    ).toBe(false);
  });
});
