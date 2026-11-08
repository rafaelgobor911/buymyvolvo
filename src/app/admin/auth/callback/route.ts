/**
 * Google returns here through Supabase Auth: exchange the code for a session
 * (PKCE) and go to the admin, which checks ADMIN_EMAILS.
 */
import type { NextRequest } from "next/server";

import { supabaseConfigured, supabaseServer } from "@/lib/admin/supabase";

const go = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !supabaseConfigured()) return go("/admin/entrar?erro=google");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return go(error ? "/admin/entrar?erro=google" : "/admin");
}
