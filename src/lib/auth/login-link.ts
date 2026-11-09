import "server-only";

import type { EmailOtpType } from "@supabase/supabase-js";
import { z } from "zod";

import { isAdminEmail } from "@/lib/admin/access";
import { supabaseConfigured, supabaseServer } from "@/lib/admin/supabase";
import { serverEnv } from "@/lib/env/server";
import { site } from "@/lib/site";

/**
 * Login by e-mail link (Supabase Auth magic link), for the admin and sellers.
 * The admin link goes out only to ADMIN_EMAILS, and the answer is the same
 * either way (no hint about who is an admin).
 */
export type LoginLinkResult = { ok: true } | { ok: false; error: LoginLinkError };
export type LoginLinkError = "indisponivel" | "email" | "limite" | "falha";

export const LOGIN_LINK_ERRORS: Record<LoginLinkError, string> = {
  indisponivel: "O login por e-mail ainda não está configurado.",
  email: "Confira o e-mail digitado.",
  limite: "Muitos pedidos de link. Aguarde alguns minutos e tente de novo.",
  falha: "Não foi possível enviar o link agora. Tente de novo em instantes.",
};

const emailSchema = z.email().max(254);

export async function sendLoginLink(input: {
  email: unknown;
  scope: "admin" | "seller";
  /** Seller only: where to go after the login. */
  next?: string;
}): Promise<LoginLinkResult> {
  if (!supabaseConfigured()) return { ok: false, error: "indisponivel" };
  const parsed = emailSchema.safeParse(
    String(input.email ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { ok: false, error: "email" };
  const email = parsed.data;
  if (input.scope === "admin" && !isAdminEmail(email, serverEnv().ADMIN_EMAILS)) {
    return { ok: true };
  }
  // Both carry a query string, so the e-mail template can append "&token_hash=…".
  const redirectTo =
    input.scope === "admin"
      ? `${site.url}/admin/auth/callback?next=%2Fadmin`
      : `${site.url}/auth/callback?next=${encodeURIComponent(input.next ?? "/vendedor")}`;
  try {
    const { error } = await (
      await supabaseServer()
    ).auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (!error) return { ok: true };
    return { ok: false, error: error.status === 429 ? "limite" : "falha" };
  } catch {
    return { ok: false, error: "falha" };
  }
}

const OTP_TYPES = new Set<EmailOtpType>(["magiclink", "email", "signup", "invite"]);

/**
 * Finishes a Supabase login on our callback, for both link formats:
 * `?token_hash=…&type=magiclink` (works in any browser; needs the e-mail
 * template from docs/login-email.md) or `?code=…` (PKCE: Google, or the
 * default template opened in the same browser).
 */
export async function completeSupabaseLogin(params: URLSearchParams): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  const supabase = await supabaseServer();
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  try {
    if (tokenHash && type && OTP_TYPES.has(type)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      return !error;
    }
    const code = params.get("code");
    if (!code) return false;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  } catch {
    return false;
  }
}
