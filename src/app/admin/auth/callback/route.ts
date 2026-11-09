/**
 * Supabase Auth returns here (Google or the e-mail link): start the session
 * and go to the admin, which checks ADMIN_EMAILS.
 */
import type { NextRequest } from "next/server";

import { completeSupabaseLogin } from "@/lib/auth/login-link";

const go = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const ok = await completeSupabaseLogin(request.nextUrl.searchParams);
  return go(ok ? "/admin" : "/admin/entrar?erro=sessao");
}
