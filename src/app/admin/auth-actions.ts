"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createTestSession, TEST_SESSION_COOKIE, TEST_SESSION_HOURS } from "@/lib/admin/access";
import { enabledTestLogin } from "@/lib/admin/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/admin/supabase";
import { serverEnv } from "@/lib/env/server";
import { site } from "@/lib/site";

/** Starts "Entrar com Google" (Supabase Auth OAuth with PKCE). */
export async function signInWithGoogle() {
  if (!supabaseConfigured()) redirect("/admin/entrar?erro=google-indisponivel");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${site.url}/admin/auth/callback` },
  });
  if (error || !data.url) redirect("/admin/entrar?erro=google");
  redirect(data.url);
}

/** Test login (e2e and screenshots only; see enabledTestLogin). */
export async function signInForTest() {
  const email = enabledTestLogin();
  const key = serverEnv().HASH_SALT;
  if (!email || !key) redirect("/admin/entrar");
  (await cookies()).set(TEST_SESSION_COOKIE, createTestSession(key, email), {
    httpOnly: true,
    sameSite: "lax",
    secure: site.url.startsWith("https://"),
    path: "/admin",
    maxAge: TEST_SESSION_HOURS * 3600,
  });
  redirect("/admin");
}

export async function signOut() {
  (await cookies()).delete({ name: TEST_SESSION_COOKIE, path: "/admin" });
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  redirect("/admin/entrar");
}
