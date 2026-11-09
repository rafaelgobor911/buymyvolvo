/**
 * Supabase Auth returns here for sellers (Google or the e-mail link): start
 * the session and go back to the page that asked for the login.
 */
import type { NextRequest } from "next/server";

import { completeSupabaseLogin } from "@/lib/auth/login-link";
import { safeNext } from "@/lib/sellers/access";

const go = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const ok = await completeSupabaseLogin(params);
  return go(ok ? next : `/vendedor/entrar?erro=sessao&next=${encodeURIComponent(next)}`);
}
