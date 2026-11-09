"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Item = { name: string; status: "enviando" | "ok" | "erro"; error?: string };

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2400;

/**
 * Downsizes in the browser (keeps each request small and drops the phone's
 * metadata early); the server re-encodes again without metadata anyway.
 */
async function downscale(file: File): Promise<Blob> {
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

export function PhotoUploader({
  listingId,
  remaining,
  licenseAccepted,
  licenseText,
}: {
  listingId: string;
  remaining: number;
  licenseAccepted: boolean;
  licenseText: string;
}) {
  const router = useRouter();
  const [license, setLicense] = useState(licenseAccepted);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function send(files: FileList) {
    const list = Array.from(files).slice(0, remaining);
    const set = (i: number, item: Item) =>
      setItems((prev) => prev.map((p, j) => (j === i ? item : p)));
    setItems(list.map((f) => ({ name: f.name, status: "enviando" })));
    setBusy(true);
    for (const [i, file] of list.entries()) {
      if (file.size > MAX_BYTES) {
        set(i, { name: file.name, status: "erro", error: "passa de 10 MB" });
        continue;
      }
      let blob: Blob = file;
      try {
        blob = await downscale(file);
      } catch {
        // The server validates and converts anyway.
      }
      const data = new FormData();
      data.append("foto", blob, "foto.jpg");
      if (license) data.append("licenca", "on");
      const response = await fetch(`/vendedor/anuncios/${listingId}/fotos`, {
        method: "POST",
        body: data,
      });
      const body = (await response.json().catch(() => ({ ok: false }))) as {
        ok: boolean;
        error?: string;
      };
      set(
        i,
        body.ok
          ? { name: file.name, status: "ok" }
          : { name: file.name, status: "erro", error: body.error ?? "falha no envio" },
      );
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {!licenseAccepted && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={license}
            onChange={(e) => setLicense(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>{licenseText}</span>
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Adicionar fotos ({remaining} restante{remaining === 1 ? "" : "s"})
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={busy || remaining <= 0 || !license}
          onChange={(e) => {
            if (e.target.files?.length) void send(e.target.files);
            e.target.value = "";
          }}
          className="text-sm font-normal file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm disabled:opacity-50"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP ou AVIF até 10 MB. As fotos são convertidas e perdem os dados do celular
        (como a localização).
      </p>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {items.map((item, i) => (
            <li
              key={i}
              className={item.status === "erro" ? "text-destructive" : "text-muted-foreground"}
            >
              {item.name}:{" "}
              {item.status === "enviando"
                ? "enviando…"
                : item.status === "ok"
                  ? "enviada"
                  : `não enviada (${item.error})`}
            </li>
          ))}
        </ul>
      )}
      {busy && (
        <Button type="button" variant="outline" disabled className="h-9 self-start rounded-xl px-3">
          Enviando…
        </Button>
      )}
    </div>
  );
}
