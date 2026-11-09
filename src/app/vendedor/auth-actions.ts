"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createTestSession, TEST_SESSION_HOURS } from "@/lib/admin/access";
import { supabaseConfigured, supabaseServer } from "@/lib/admin/supabase";
import { sendLoginLink } from "@/lib/auth/login-link";
import { serverEnv } from "@/lib/env/server";
import { safeNext, SELLER_TEST_COOKIE } from "@/lib/sellers/access";
import { enabledSellerTestLogin } from "@/lib/sellers/auth";
import { site } from "@/lib/site";

const nextOf = (form: FormData) => safeNext(form.get("next"));

/** "Entrar com Google" for sellers (Supabase Auth, PKCE), back to where they were. */
export async function signInSellerWithGoogle(form: FormData) {
  const next = nextOf(form);
  if (!supabaseConfigured())
    redirect(`/vendedor/entrar?erro=google-indisponivel&next=${encodeURIComponent(next)}`);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${site.url}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/vendedor/entrar?erro=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

/** "Receber link por e-mail" (any e-mail: the account is created on the first login). */
export async function requestSellerLoginLink(form: FormData) {
  const next = nextOf(form);
  const back = (query: string) => `/vendedor/entrar?${query}&next=${encodeURIComponent(next)}`;
  if (form.get("site")) redirect(back("link=enviado"));
  const result = await sendLoginLink({ email: form.get("email"), scope: "seller", next });
  redirect(back(result.ok ? "link=enviado" : `erro=link-${result.error}`));
}

/** Test login (e2e and screenshots only; see enabledSellerTestLogin). */
export async function signInSellerForTest(form: FormData) {
  const email = enabledSellerTestLogin();
  const key = serverEnv().HASH_SALT;
  if (!email || !key) redirect("/vendedor/entrar");
  (await cookies()).set(SELLER_TEST_COOKIE, createTestSession(key, email, Date.now(), "seller"), {
    httpOnly: true,
    sameSite: "lax",
    secure: site.url.startsWith("https://"),
    path: "/",
    maxAge: TEST_SESSION_HOURS * 3600,
  });
  redirect(nextOf(form));
}

export async function signOutSeller() {
  (await cookies()).delete({ name: SELLER_TEST_COOKIE, path: "/" });
  if (supabaseConfigured()) {
    try {
      await (await supabaseServer()).auth.signOut();
    } catch {
      // Auth server unreachable: the local cookies are gone anyway.
    }
  }
  redirect("/");
}
