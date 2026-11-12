/**
 * Downsizes a photo in the browser before it is sent (keeps each request
 * small and drops the phone's metadata early); the server re-encodes it again
 * without metadata anyway. Browser only.
 */
export const PHOTO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2400;

export async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
      "image/jpeg",
      0.9,
    ),
  );
}
