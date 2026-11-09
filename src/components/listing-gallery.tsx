import type { ListingPhoto } from "@/lib/listings/queries";

/**
 * The seller's licensed photos (claimed listings only). A plain scroll-snap
 * row: swipe on the phone, scroll on the desktop, no JavaScript.
 */
export function ListingGallery({ photos, title }: { photos: ListingPhoto[]; title: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <ol
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl"
        aria-label={`Fotos do ${title}`}
      >
        {photos.map((photo, i) => (
          <li key={photo.url} className="w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- already resized WebP from our storage */}
            <img
              src={photo.url}
              srcSet={`${photo.urlSmall} 640w, ${photo.url} 1600w`}
              sizes="(min-width: 1024px) 720px, 100vw"
              alt={`${title}: foto ${i + 1} de ${photos.length}`}
              width={photo.width ?? 1600}
              height={photo.height ?? 1200}
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-[4/3] w-full rounded-2xl bg-muted object-cover"
            />
          </li>
        ))}
      </ol>
      <figcaption className="text-sm text-muted-foreground">
        {photos.length} foto{photos.length === 1 ? "" : "s"} enviada{photos.length === 1 ? "" : "s"}{" "}
        pelo vendedor{photos.length > 1 ? " · arraste para ver as outras" : ""}.
      </figcaption>
    </figure>
  );
}
