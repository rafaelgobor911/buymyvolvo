import { BadgeCheck } from "lucide-react";
import Link from "next/link";

import { ModelPlate } from "@/components/model-plate";
import { Badge } from "@/components/ui/badge";
import {
  formatKm,
  formatPlace,
  formatPrice,
  formatRelativeDays,
  formatYears,
} from "@/lib/listings/format";
import type { ListingCard as Listing } from "@/lib/listings/queries";

export function listingTitle(l: Pick<Listing, "modelName" | "engineName" | "trimName">) {
  return [l.modelName, l.engineName, l.trimName].filter(Boolean).join(" ");
}

export function ListingCard({
  listing,
  now,
  headingLevel = 3,
}: {
  listing: Listing;
  now: Date;
  /** Card title level: one below the section heading that holds the grid. */
  headingLevel?: 2 | 3;
}) {
  const title = listingTitle(listing);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
      {listing.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- already resized WebP from our storage
        <img
          src={listing.coverUrl}
          alt=""
          loading="lazy"
          width={640}
          height={400}
          className="aspect-[16/10] w-full bg-muted object-cover"
        />
      ) : (
        <ModelPlate
          modelId={listing.modelId}
          modelName={listing.modelName}
          yearModel={listing.yearModel}
          className="aspect-[2/1] sm:aspect-[16/10]"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <Heading className="leading-snug font-medium text-balance">
            <Link
              href={`/anuncio/${listing.slug}`}
              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
            >
              Volvo {title}
            </Link>
          </Heading>
          {listing.isClaimed && (
            <BadgeCheck
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-label="Vendedor verificado"
            />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {formatYears(listing.yearFab, listing.yearModel)} · {formatKm(listing.km)}
        </p>
        {listing.alerts.includes("repasse") && <RepasseBadge className="self-start" />}
        <p className="mt-auto pt-2 text-xl font-semibold tracking-tight">
          {formatPrice(listing.priceCents)}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>{formatPlace(listing.city, listing.uf)}</span>
          <span aria-hidden>·</span>
          <span>
            {listing.sellerType === "loja"
              ? "Loja"
              : listing.sellerType === "particular"
                ? "Particular"
                : "Vendedor"}
          </span>
          <span aria-hidden>·</span>
          <time dateTime={listing.firstSeenAt.toISOString()}>
            {formatRelativeDays(listing.firstSeenAt, now)}
          </time>
        </p>
      </div>
    </article>
  );
}

/** "Repasse": the listing's own post calls the sale a repasse. */
export function RepasseBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-warning/60 bg-warning-soft text-warning-foreground ${className ?? ""}`}
      title="O próprio anúncio se descreve como repasse"
    >
      Repasse
    </Badge>
  );
}

export function ListingGrid({
  listings,
  now,
  headingLevel,
}: {
  listings: Listing[];
  now: Date;
  headingLevel?: 2 | 3;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <li key={listing.id} className="flex">
          <ListingCard listing={listing} now={now} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
