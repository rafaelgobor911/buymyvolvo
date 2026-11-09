/**
 * Photo upload for a claimed listing: one file per request (the browser
 * downsizes it first). Checks the seller session, ownership, the photo
 * license and the per-listing limit, then re-encodes without metadata.
 */
import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { PHOTO_LICENSE_VERSION } from "@/content/photo-license";
import { db } from "@/lib/db/client";
import { addPhoto, photoCount } from "@/lib/photos/data";
import {
  PhotoError,
  PHOTO_MAX_BYTES,
  PHOTOS_PER_LISTING,
  processPhoto,
} from "@/lib/photos/process";
import { photoStorage } from "@/lib/photos/storage";
import { currentSellerUser, sellerActor } from "@/lib/sellers/auth";
import {
  acceptTerms,
  getSellerByAuthUser,
  hasAcceptedTerms,
  sellerEditableListing,
} from "@/lib/sellers/data";

const reply = (status: number, body: { ok: boolean; error?: string }) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/vendedor/anuncios/[id]/fotos">,
) {
  // Same-origin only (cookies are SameSite=Lax; this is a second guard).
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return reply(403, { ok: false, error: "Origem não permitida." });
  }
  const user = await currentSellerUser();
  if (!user) return reply(401, { ok: false, error: "Entre de novo para enviar fotos." });
  const { id } = await ctx.params;
  const sql = db();
  const seller = await getSellerByAuthUser(sql, user.authUserId);
  const listing =
    seller && (await sellerEditableListing(sql, { sellerId: seller.id, listingId: id }));
  if (!seller || !listing) return reply(404, { ok: false, error: "Anúncio não encontrado." });
  const storage = photoStorage();
  if (!storage)
    return reply(503, { ok: false, error: "O envio de fotos ainda não está disponível." });

  const form = await request.formData();
  const file = form.get("foto");
  if (!(file instanceof File)) return reply(400, { ok: false, error: "Nenhuma foto recebida." });
  if (file.size > PHOTO_MAX_BYTES)
    return reply(413, { ok: false, error: "A foto passa de 10 MB." });

  const license = {
    sellerId: seller.id,
    terms: "photo_license" as const,
    version: PHOTO_LICENSE_VERSION,
  };
  if (!(await hasAcceptedTerms(sql, license))) {
    if (form.get("licenca") !== "on") {
      return reply(400, { ok: false, error: "Aceite a licença de uso das fotos para enviar." });
    }
    await acceptTerms(sql, license);
  }
  if ((await photoCount(sql, id)) >= PHOTOS_PER_LISTING) {
    return reply(400, {
      ok: false,
      error: `Cada anúncio pode ter até ${PHOTOS_PER_LISTING} fotos.`,
    });
  }

  let photo;
  try {
    photo = await processPhoto(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof PhotoError) return reply(400, { ok: false, error: error.message });
    throw error;
  }
  const photoId = randomUUID();
  const storagePath = `${id}/${photoId}`;
  const objects = [`${storagePath}-1600.webp`, `${storagePath}-640.webp`];
  await storage.put(objects[0]!, photo.large, "image/webp");
  await storage.put(objects[1]!, photo.small, "image/webp");
  const added = await addPhoto(sql, {
    id: photoId,
    listingId: id,
    sellerId: seller.id,
    storagePath,
    width: photo.width,
    height: photo.height,
    licenseVersion: PHOTO_LICENSE_VERSION,
    actor: sellerActor(seller.id),
  });
  if (!added.ok) {
    await storage.remove(objects);
    return reply(400, { ok: false, error: added.error });
  }
  return reply(200, { ok: true });
}
