import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { readTestSession, testLoginEmail } from "@/lib/admin/access";
import { supabaseConfigured, supabaseServer } from "@/lib/admin/supabase";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

import { SELLER_TEST_COOKIE, testUserId } from "./access";

export interface SellerUser {
  /** Supabase Auth user id (or a stable test id). */
  authUserId: string;
  email: string;
  name: string | null;
  via: "supabase" | "test";
}

/** The seller test login's e-mail when it is enabled here, else null. */
export function enabledSellerTestLogin(): string | null {
  const env = serverEnv();
  return testLoginEmail({
    ADMIN_TEST_LOGIN_EMAIL: env.SELLER_TEST_LOGIN_EMAIL,
    VERCEL_ENV: env.VERCEL_ENV,
    demoMode: publicEnv.NEXT_PUBLIC_DEMO_MODE,
  });
}

/**
 * The signed-in seller account, or null. Google sessions are validated with
 * the Supabase Auth server (getUser); the test login uses a signed cookie.
 */
export async function currentSellerUser(): Promise<SellerUser | null> {
  await connection();
  const env = serverEnv();
  const testEmail = enabledSellerTestLogin();
  if (testEmail && env.HASH_SALT) {
    const value = (await cookies()).get(SELLER_TEST_COOKIE)?.value;
    const email = readTestSession(env.HASH_SALT, value, Date.now(), "seller");
    if (email === testEmail) {
      return { authUserId: testUserId(email), email, name: "Vendedor de teste", via: "test" };
    }
  }
  if (supabaseConfigured()) {
    try {
      const { data } = await (await supabaseServer()).auth.getUser();
      const user = data.user;
      if (user?.email) {
        const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
        return {
          authUserId: user.id,
          email: user.email.toLowerCase(),
          name: meta?.full_name ?? meta?.name ?? null,
          via: "supabase",
        };
      }
    } catch {
      // Auth server unreachable: treat as signed out.
    }
  }
  return null;
}

/** Use at the top of every seller page and action: sends to the login otherwise. */
export async function requireSellerUser(next: string): Promise<SellerUser> {
  const user = await currentSellerUser();
  if (!user) redirect(`/vendedor/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

export const sellerActor = (sellerId: string) => `seller:${sellerId}`;
