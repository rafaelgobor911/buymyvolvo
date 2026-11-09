import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

import {
  type Admin,
  isAdminEmail,
  readTestSession,
  TEST_SESSION_COOKIE,
  testLoginEmail,
} from "./access";
import { supabaseConfigured, supabaseServer } from "./supabase";

export type { Admin } from "./access";

/** The test login's e-mail when it is enabled here, else null. */
export function enabledTestLogin(): string | null {
  const env = serverEnv();
  return testLoginEmail({ ...env, demoMode: publicEnv.NEXT_PUBLIC_DEMO_MODE });
}

/**
 * The signed-in admin, or null. Google sessions are checked against the
 * Supabase Auth server (getUser), never trusted from the cookie alone; the
 * e-mail must be in ADMIN_EMAILS.
 */
export async function currentAdmin(): Promise<Admin | null> {
  // Request time only: the session check reads the clock (expiry) and the Auth server.
  await connection();
  const env = serverEnv();
  const testEmail = enabledTestLogin();
  if (testEmail && env.HASH_SALT) {
    const email = readTestSession(env.HASH_SALT, (await cookies()).get(TEST_SESSION_COOKIE)?.value);
    if (email === testEmail && isAdminEmail(email, env.ADMIN_EMAILS)) return { email, via: "test" };
  }
  if (supabaseConfigured()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase();
    if (email && isAdminEmail(email, env.ADMIN_EMAILS)) return { email, via: "supabase" };
  }
  return null;
}

/** Use at the top of every admin page and Server Action: redirects to the login otherwise. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/entrar");
  return admin;
}

/** Actor recorded in audit_log for an admin action. */
export const actorOf = (admin: Admin) => `admin:${admin.email}`;
