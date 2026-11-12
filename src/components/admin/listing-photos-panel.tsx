import "server-only";

import { Images } from "lucide-react";

import { db } from "@/lib/db/client";
import { listPhotos } from "@/lib/photos/data";
import { photoUrl } from "@/lib/photos/storage";

import { PhotoDeleteButton } from "./photo-delete-button";

/** The listing's photos (sent by the seller), for the admin to review before approving. */
export async function ListingPhotosPanel({ listingId }: { listingId: string }) {
  const photos = await listPhotos(db(), listingId);
  if (photos.length === 0) return null;
  return (
    <section
      aria-labelledby="fotos"
      className="flex flex-col gap-3 rounded-xl border border-border p-4"
    >
      <h2 id="fotos" className="flex items-center gap-2 font-semibold">
        <Images className="size-4" aria-hidden />
        Fotos ({photos.length})
      </h2>
      <p className="text-xs text-muted-foreground">
        Confira antes de aprovar: nada de placa legível, telefone, marca d&apos;água ou foto que não
        seja do carro. A primeira é a capa.
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => {
          const url = photoUrl(p.storagePath, 640);
          return (
            <li key={p.id} className="relative">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                <img
                  src={url}
                  alt={`Foto ${i + 1}${i === 0 ? " (capa)" : ""}`}
                  className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="aspect-[4/3] rounded-lg border border-dashed border-border" />
              )}
              <PhotoDeleteButton photoId={p.id} label={`Excluir a foto ${i + 1}`} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
