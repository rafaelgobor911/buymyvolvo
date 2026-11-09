import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { PhotoError, processPhoto } from "./process";

const jpegWithGps = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 40, g: 70, b: 110 } } })
    .withExif({
      IFD0: { Make: "TestPhone" },
      IFD3: {
        GPSLatitudeRef: "S",
        GPSLatitude: "23/1 32/1 0/1",
        GPSLongitudeRef: "W",
        GPSLongitude: "46/1 38/1 0/1",
      },
    })
    .jpeg()
    .toBuffer();

describe("processPhoto", () => {
  it("re-encodes as WebP in two sizes and drops every metadata (GPS included)", async () => {
    const input = await jpegWithGps(2400, 1800);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processPhoto(input);
    expect({ width: out.width, height: out.height }).toEqual({ width: 1600, height: 1200 });
    for (const buffer of [out.large, out.small]) {
      const meta = await sharp(buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
    }
    expect((await sharp(out.small).metadata()).width).toBe(640);
  });

  it("applies the phone's rotation before dropping it, and never enlarges", async () => {
    // Orientation 6 = rotated 90°: a 1200×900 sensor image is shown as 900×1200.
    const rotated = await sharp({
      create: { width: 1200, height: 900, channels: 3, background: "#456" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect((await sharp(rotated).metadata()).orientation).toBe(6);
    const out = await processPhoto(rotated);
    expect({ width: out.width, height: out.height }).toEqual({ width: 900, height: 1200 });
  });

  it("rejects what is not a usable photo", async () => {
    await expect(processPhoto(Buffer.from("não é imagem"))).rejects.toBeInstanceOf(PhotoError);
    const gif = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#888" },
    })
      .gif()
      .toBuffer();
    await expect(processPhoto(gif)).rejects.toThrow(/JPEG, PNG, WebP ou AVIF/);
    await expect(processPhoto(await jpegWithGps(300, 200))).rejects.toThrow(/pequena demais/);
  });
});
