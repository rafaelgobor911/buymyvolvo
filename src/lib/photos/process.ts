/**
 * Seller photos are re-encoded on the server: rotated upright, resized and
 * saved as WebP without any metadata (EXIF/GPS from the phone is dropped).
 */
import sharp, { type Metadata } from "sharp";

export const PHOTOS_PER_LISTING = 15;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_SIZES = { large: 1600, small: 640 } as const;

const ACCEPTED = new Set(["jpeg", "png", "webp", "avif"]);

export class PhotoError extends Error {}

export interface ProcessedPhoto {
  large: Buffer;
  small: Buffer;
  width: number;
  height: number;
}

export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.byteLength > PHOTO_MAX_BYTES) throw new PhotoError("A foto passa de 10 MB.");
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new PhotoError("Arquivo de imagem inválido.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new PhotoError("Use fotos em JPEG, PNG, WebP ou AVIF.");
  }
  if ((meta.width ?? 0) < 400 || (meta.height ?? 0) < 300) {
    throw new PhotoError("A foto é pequena demais (mínimo de 400 × 300 pixels).");
  }
  // sharp drops metadata unless withMetadata() is called; rotate() applies the EXIF orientation first.
  const encode = (size: number) =>
    sharp(input)
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  const [large, small] = await Promise.all([encode(PHOTO_SIZES.large), encode(PHOTO_SIZES.small)]);
  return {
    large: large.data,
    small: small.data,
    width: large.info.width,
    height: large.info.height,
  };
}
