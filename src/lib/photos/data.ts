/**
 * listing_photos rows for the seller's listings. Receives `sql` by parameter;
 * the files themselves go through PhotoStorage. Every change goes to audit_log.
 */
import type postgres from "postgres";

import { PHOTOS_PER_LISTING } from "./process";

type Sql = postgres.Sql;

export interface PhotoRow {
  id: string;
  storagePath: string;
  width: number | null;
  height: number | null;
  position: number;
}

export async function listPhotos(sql: Sql, listingId: string): Promise<PhotoRow[]> {
  return sql<PhotoRow[]>`
    select id, storage_path as "storagePath", width, height, position
    from public.listing_photos where listing_id = ${listingId}
    order by position, created_at`;
}

export type AddPhotoResult = { ok: true } | { ok: false; error: string };

/** Adds the row after the files were stored; enforces the per-listing limit under a lock. */
export async function addPhoto(
  sql: Sql,
  input: {
    id: string;
    listingId: string;
    sellerId: string;
    storagePath: string;
    width: number;
    height: number;
    licenseVersion: string;
    actor: string;
  },
): Promise<AddPhotoResult> {
  return sql.begin(async (tx) => {
    const [listing] = await tx<{ seller_id: string | null }[]>`
      select seller_id from public.listings where id = ${input.listingId} for update`;
    if (listing?.seller_id !== input.sellerId)
      return { ok: false, error: "Anúncio não encontrado." };
    const [{ n, next }] = await tx<{ n: number; next: number }[]>`
      select count(*)::int as n, coalesce(max(position) + 1, 0)::int as next
      from public.listing_photos where listing_id = ${input.listingId}`;
    if (n >= PHOTOS_PER_LISTING) {
      return { ok: false, error: `Cada anúncio pode ter até ${PHOTOS_PER_LISTING} fotos.` };
    }
    await tx`
      insert into public.listing_photos (id, listing_id, seller_id, storage_path, width, height,
        position, license_terms_version, license_granted_at)
      values (${input.id}, ${input.listingId}, ${input.sellerId}, ${input.storagePath},
        ${input.width}, ${input.height}, ${next}, ${input.licenseVersion}, now())`;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'photo.add', 'listing', ${input.listingId},
        ${tx.json({ photo: { from: null, to: input.id } })})`;
    return { ok: true };
  });
}

export async function photoCount(sql: Sql, listingId: string): Promise<number> {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.listing_photos where listing_id = ${listingId}`;
  return n;
}

/** Deletes the row and returns the storage path, so the caller removes the files. */
export async function deletePhoto(
  sql: Sql,
  input: { photoId: string; sellerId: string; actor: string },
): Promise<string | null> {
  return sql.begin(async (tx) => {
    const [row] = await tx<{ listing_id: string; storage_path: string }[]>`
      delete from public.listing_photos
      where id = ${input.photoId} and seller_id = ${input.sellerId}
      returning listing_id, storage_path`;
    if (!row) return null;
    await tx`
      insert into public.audit_log (actor, action, entity, entity_id, changes)
      values (${input.actor}, 'photo.delete', 'listing', ${row.listing_id},
        ${tx.json({ photo: { from: input.photoId, to: null } })})`;
    return row.storage_path;
  });
}

/** Moves a photo one place up or down (the first one is the cover). */
export async function movePhoto(
  sql: Sql,
  input: { photoId: string; sellerId: string; direction: "up" | "down" },
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [photo] = await tx<{ listing_id: string }[]>`
      select listing_id from public.listing_photos
      where id = ${input.photoId} and seller_id = ${input.sellerId}`;
    if (!photo) return false;
    await tx`select 1 from public.listings where id = ${photo.listing_id} for update`;
    const rows = await tx<{ id: string }[]>`
      select id from public.listing_photos where listing_id = ${photo.listing_id}
      order by position, created_at`;
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(input.photoId);
    const j = input.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return false;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    for (const [position, id] of ids.entries()) {
      await tx`update public.listing_photos set position = ${position} where id = ${id}`;
    }
    return true;
  });
}

/** Public cover photo (first one) of each listing, for cards. */
export async function coverPhotos(sql: Sql, listingIds: string[]): Promise<Map<string, string>> {
  if (!listingIds.length) return new Map();
  const rows = await sql<{ listing_id: string; storage_path: string }[]>`
    select distinct on (listing_id) listing_id, storage_path from public.listing_photos
    where listing_id = any(${listingIds}) order by listing_id, position, created_at`;
  return new Map(rows.map((r) => [r.listing_id, r.storage_path]));
}
