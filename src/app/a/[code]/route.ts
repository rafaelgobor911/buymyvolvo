/**
 * Short link used in the WhatsApp message (`{url}`): /a/<listing code> leads
 * to the listing page, so the seller sees where the contact came from.
 */
import type { NextRequest } from "next/server";
import { connection } from "next/server";

import { db } from "@/lib/db/client";
import { publicSlugFor } from "@/lib/leads/record";

export async function GET(_request: NextRequest, ctx: RouteContext<"/a/[code]">) {
  await connection();
  const { code } = await ctx.params;
  const slug = await publicSlugFor(db(), code);
  return new Response(null, {
    status: 302,
    headers: { Location: slug ? `/anuncio/${slug}` : "/busca", "Cache-Control": "no-store" },
  });
}
