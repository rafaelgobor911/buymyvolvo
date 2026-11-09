/** Serves photos from the local storage (development, tests, CI). In production they come from Supabase Storage. */
import type { NextRequest } from "next/server";

import { readLocalPhoto } from "@/lib/photos/storage";

export async function GET(_request: NextRequest, ctx: RouteContext<"/fotos/[...path]">) {
  const { path } = await ctx.params;
  const data = await readLocalPhoto(path.join("/"));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=3600" },
  });
}
