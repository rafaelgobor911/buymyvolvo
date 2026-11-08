/**
 * Google returns here through Supabase Auth (sellers): exchange the code for a
 * session (PKCE) and go back to the page that asked for the login.
 */
import type { NextRequest } from "next/server";

import { supabaseConfigured, supabaseServer } from "@/lib/admin/supabase";
import { safeNext } from "@/lib/sellers/access";

const go = (path: string) =>
  new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));
  const code = params.get("code");
  const failed = `/vendedor/entrar?erro=google&next=${encodeURIComponent(next)}`;
  if (!code || !supabaseConfigured()) return go(failed);
  const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
  return go(error ? failed : next);
}
