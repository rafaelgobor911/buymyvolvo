import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/**
 * Where seller photos live. Supabase Storage (public bucket) when the secret
 * key is configured; otherwise, only in demo mode outside Vercel production,
 * a local folder served by /fotos (development, tests, CI). No storage → no
 * uploads.
 */
export interface PhotoStorage {
  kind: "supabase" | "local";
  put(objectPath: string, data: Buffer, contentType: string): Promise<void>;
  remove(objectPaths: string[]): Promise<void>;
  url(objectPath: string): string;
}

export const PHOTO_BUCKET = "listing-photos";
export const LOCAL_PHOTO_DIR = path.join(process.cwd(), ".data", "photos");

/** "<listing uuid>/<photo uuid>-<size>.webp" only: nothing else is ever read or written. */
export const SAFE_OBJECT_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}-(640|1600)\.webp$/;

let bucketReady: Promise<void> | null = null;

function supabaseStorage(url: string, secret: string): PhotoStorage {
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = client.storage;
  const ensureBucket = () => {
    bucketReady ??= (async () => {
      const { error } = await storage.getBucket(PHOTO_BUCKET);
      if (!error) return;
      const created = await storage.createBucket(PHOTO_BUCKET, {
        public: true,
        fileSizeLimit: "5MB",
        allowedMimeTypes: ["image/webp"],
      });
      if (created.error && !/exist/i.test(created.error.message)) {
        bucketReady = null;
        throw created.error;
      }
    })();
    return bucketReady;
  };
  return {
    kind: "supabase",
    async put(objectPath, data, contentType) {
      await ensureBucket();
      const { error } = await storage
        .from(PHOTO_BUCKET)
        .upload(objectPath, data, { contentType, upsert: true, cacheControl: "31536000" });
      if (error) throw error;
    },
    async remove(objectPaths) {
      if (!objectPaths.length) return;
      const { error } = await storage.from(PHOTO_BUCKET).remove(objectPaths);
      if (error) throw error;
    },
    url: (objectPath) => `${url}/storage/v1/object/public/${PHOTO_BUCKET}/${objectPath}`,
  };
}

const localStorage: PhotoStorage = {
  kind: "local",
  async put(objectPath, data) {
    if (!SAFE_OBJECT_PATH.test(objectPath)) throw new Error("Invalid photo path.");
    const file = path.join(LOCAL_PHOTO_DIR, objectPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  },
  async remove(objectPaths) {
    for (const objectPath of objectPaths) {
      if (!SAFE_OBJECT_PATH.test(objectPath)) continue;
      await unlink(path.join(LOCAL_PHOTO_DIR, objectPath)).catch(() => {});
    }
  },
  url: (objectPath) => `/fotos/${objectPath}`,
};

let supabaseInstance: PhotoStorage | null = null;

/** Which storage is active here, without creating any client. */
export function photoStorageKind(): PhotoStorage["kind"] | null {
  const env = serverEnv();
  if (publicEnv.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (publicEnv.NEXT_PUBLIC_DEMO_MODE && env.VERCEL_ENV !== "production") return "local";
  return null;
}

export function photoStorage(): PhotoStorage | null {
  const kind = photoStorageKind();
  if (kind === "supabase") {
    supabaseInstance ??= supabaseStorage(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
      serverEnv().SUPABASE_SERVICE_ROLE_KEY!,
    );
    return supabaseInstance;
  }
  return kind === "local" ? localStorage : null;
}

/** Reads a locally stored photo (only when the local storage is the active one). */
export async function readLocalPhoto(objectPath: string): Promise<Buffer | null> {
  if (photoStorage()?.kind !== "local" || !SAFE_OBJECT_PATH.test(objectPath)) return null;
  return readFile(path.join(LOCAL_PHOTO_DIR, objectPath)).catch(() => null);
}

/** Public URL of one size of a photo ("<listing>/<photo>" + size). */
export function photoUrl(storagePath: string, size: 640 | 1600): string | null {
  const objectPath = `${storagePath}-${size}.webp`;
  const kind = photoStorageKind();
  if (kind === "supabase") {
    return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${objectPath}`;
  }
  return kind === "local" ? `/fotos/${objectPath}` : null;
}
