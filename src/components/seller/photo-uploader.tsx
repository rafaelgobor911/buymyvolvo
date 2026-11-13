"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PhotoPicker } from "@/components/photo-picker";
import { CHOICE_BOX, CHOICE_ROW } from "@/components/public-fields";
import { Button } from "@/components/ui/button";
import { downscale, PHOTO_UPLOAD_MAX_BYTES as MAX_BYTES } from "@/lib/photos/downscale";
import { cn } from "@/lib/utils";

type Item = { name: string; status: "enviando" | "ok" | "erro"; error?: string };

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
        <label className={cn(CHOICE_ROW, "items-start py-2.5")}>
          <input
            type="checkbox"
            checked={license}
            onChange={(e) => setLicense(e.target.checked)}
            className={CHOICE_BOX}
          />
          <span className="text-pretty">{licenseText}</span>
        </label>
      )}
      <PhotoPicker
        label="Adicionar fotos"
        detail={`${remaining} ${remaining === 1 ? "foto restante" : "fotos restantes"}`}
        disabled={busy || remaining <= 0 || !license}
        describedBy="fotos-dica"
        onFiles={(files) => void send(files)}
      />
      <p id="fotos-dica" className="text-xs text-pretty text-muted-foreground">
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
