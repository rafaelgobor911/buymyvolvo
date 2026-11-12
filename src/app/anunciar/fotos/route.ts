/**
 * Photos of a listing just sent by the public form: one file per request (the
 * browser downsizes it first), with the upload token from the form's answer.
 * The seller granted the photo license in the form (Termos do Anunciante,
 * section 5). Same processing as the seller panel: re-encoded without metadata.
 */
import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { SELLER_TERMS_VERSION } from "@/content/seller-terms";
import { db } from "@/lib/db/client";
import { requireKeys, serverEnv } from "@/lib/env/server";
import { addPhoto, photoCount } from "@/lib/photos/data";
import {
  PhotoError,
  PHOTO_MAX_BYTES,
  PHOTOS_PER_LISTING,
  processPhoto,
} from "@/lib/photos/process";
import { photoStorage } from "@/lib/photos/storage";
import { submittedListingForPhotos } from "@/lib/submissions/create";
import { photoTokenValid } from "@/lib/submissions/photo-token";

const reply = (status: number, body: { ok: boolean; error?: string }) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return reply(403, { ok: false, error: "Origem não permitida." });
  }
  const storage = photoStorage();
  if (!storage)
    return reply(503, { ok: false, error: "O envio de fotos ainda não está disponível." });

  const form = await request.formData();
  const listingId = form.get("anuncio");
  const token = form.get("token");
  const file = form.get("foto");
  if (typeof listingId !== "string" || typeof token !== "string") {
    return reply(400, { ok: false, error: "Envio inválido." });
  }
  const { HASH_SALT } = requireKeys(serverEnv(), ["HASH_SALT"]);
  if (!photoTokenValid(HASH_SALT, listingId, token)) {
    return reply(403, { ok: false, error: "O prazo para enviar fotos acabou. Fale com a gente." });
  }
  const sql = db();
  const listing = await submittedListingForPhotos(sql, listingId);
  if (!listing) return reply(404, { ok: false, error: "Anúncio não encontrado." });
  if (!(file instanceof File)) return reply(400, { ok: false, error: "Nenhuma foto recebida." });
  if (file.size > PHOTO_MAX_BYTES)
    return reply(413, { ok: false, error: "A foto passa de 10 MB." });
  if ((await photoCount(sql, listing.id)) >= PHOTOS_PER_LISTING) {
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
  const storagePath = `${listing.id}/${photoId}`;
  const objects = [`${storagePath}-1600.webp`, `${storagePath}-640.webp`];
  await storage.put(objects[0]!, photo.large, "image/webp");
  await storage.put(objects[1]!, photo.small, "image/webp");
  const added = await addPhoto(sql, {
    id: photoId,
    listingId: listing.id,
    sellerId: listing.sellerId,
    storagePath,
    width: photo.width,
    height: photo.height,
    licenseVersion: SELLER_TERMS_VERSION,
    actor: "public:listing-form",
  });
  if (!added.ok) {
    await storage.remove(objects);
    return reply(400, { ok: false, error: added.error });
  }
  return reply(200, { ok: true });
}
