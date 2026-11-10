import { BadgeCheck, ExternalLink, Info, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after, connection } from "next/server";
import { cache, Suspense } from "react";

import { TrackEvent } from "@/components/analytics/analytics";
import { JsonLd } from "@/components/json-ld";
import { ListingAlerts } from "@/components/listing-alerts";
import { ListingGrid, listingTitle, RepasseBadge } from "@/components/listing-card";
import { ListingGallery } from "@/components/listing-gallery";
import { ModelPlate } from "@/components/model-plate";
import { SafetyTips } from "@/components/safety-tips";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { checklistFor, checklistTitle, MADE_BY_SWEDEN_URL } from "@/content/checklists";
import {
  formatKm,
  formatPlace,
  formatPrice,
  formatRelativeDays,
  formatYears,
} from "@/lib/listings/format";
import { leadParams, type ListingForAnalytics, viewItemParams } from "@/lib/analytics/items";
import { db } from "@/lib/db/client";
import { isBot, isPrefetch } from "@/lib/leads/request";
import { getListingBySlug, getSimilarListings, type ListingDetail } from "@/lib/listings/queries";
import { recordView } from "@/lib/listings/views";
import { breadcrumbJsonLd, carJsonLd } from "@/lib/seo/json-ld";
import { landingPath, LANDING_ROOT } from "@/lib/seo/landing";
import { absoluteUrl, site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { FUEL_LABELS, getModel, TRANSMISSION_LABELS } from "@/lib/taxonomy";

const loadListing = cache(getListingBySlug);

export async function generateMetadata(props: PageProps<"/anuncio/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Anúncio não encontrado", robots: { index: false } };
  const title = `Volvo ${listingTitle(listing)} ${formatYears(listing.yearFab, listing.yearModel)}`;
  const facts = [
    listing.priceCents !== null && formatPrice(listing.priceCents),
    listing.km !== null && formatKm(listing.km),
    (listing.city || listing.uf) && formatPlace(listing.city, listing.uf),
  ]
    .filter(Boolean)
    .join(" · ");
  const text = listing.sellerDescription?.slice(0, 160) ?? listing.summary;
  const description = [facts, text].filter(Boolean).join(". ") || undefined;
  const cover = listing.photos[0];
  return {
    title,
    description,
    alternates: { canonical: `/anuncio/${listing.slug}` },
    robots: listing.status === "active" ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/anuncio/${listing.slug}`,
      ...(cover
        ? {
            images: [
              {
                url: cover.url,
                width: cover.width ?? undefined,
                height: cover.height ?? undefined,
              },
            ],
          }
        : {}),
    },
  };
}

export default function ListingPage(props: PageProps<"/anuncio/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ListingView params={props.params} />
    </Suspense>
  );
}

async function ListingView({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();
  // Views for the admin's click rate: a daily counter, no visitor data; bots and prefetches skipped.
  if (listing.status === "active") {
    const requestHeaders = await headers();
    if (!isBot(requestHeaders.get("user-agent")) && !isPrefetch(requestHeaders)) {
      after(() => recordView(db(), listing.id).catch(() => {}));
    }
  }
  const now = new Date();
  const similar = await getSimilarListings(listing.modelId, listing.id, 3);
  const title = listingTitle(listing);
  const model = getModel(listing.modelId);
  const baseModelId = model?.parentId ?? listing.modelId;
  const baseModelName = getModel(baseModelId)?.name ?? listing.modelName;
  const isActive = listing.status === "active";
  const url = absoluteUrl(`/anuncio/${listing.slug}`);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-6 pb-32 sm:px-6 lg:pb-16">
      {isActive && (
        <TrackEvent
          name="view_item"
          id={listing.id}
          params={viewItemParams(forAnalytics(listing))}
        />
      )}
      {isActive && (
        <JsonLd
          data={[
            carJsonLd({
              url,
              name: `Volvo ${title}`,
              modelName: listing.modelName,
              engineName: listing.engineName,
              yearFab: listing.yearFab,
              yearModel: listing.yearModel,
              km: listing.km,
              priceCents: listing.priceCents,
              fuel: listing.fuel,
              transmission: listing.transmission,
              color: listing.color,
              city: listing.city,
              uf: listing.uf,
              description: listing.sellerDescription ?? listing.summary,
              images: listing.photos.map((p) =>
                p.url.startsWith("/") ? absoluteUrl(p.url) : p.url,
              ),
              seller: listing.sellerName
                ? { name: listing.sellerName, type: listing.sellerType }
                : null,
              available: true,
            }),
            breadcrumbJsonLd([
              { name: "Volvo à venda", url: absoluteUrl(LANDING_ROOT) },
              { name: baseModelName, url: absoluteUrl(landingPath({ modelId: baseModelId })) },
              { name: `Volvo ${title}`, url },
            ]),
          ]}
        />
      )}
      <nav aria-label="Navegação estrutural" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={LANDING_ROOT} className="hover:text-foreground">
              Volvo à venda
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={landingPath({ modelId: baseModelId })} className="hover:text-foreground">
              {baseModelName}
            </Link>
          </li>
        </ol>
      </nav>

      {(!isActive || listing.possiblyUnavailable) && <StatusNotice listing={listing} />}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-8">
          <MediaBlock listing={listing} />

          <section aria-labelledby="sobre" className="flex flex-col gap-3">
            <h2 id="sobre" className="text-xl font-semibold tracking-tight">
              Sobre este carro
            </h2>
            {listing.sellerDescription ? (
              <>
                <p className="text-pretty whitespace-pre-line text-muted-foreground">
                  {listing.sellerDescription}
                </p>
                <p className="text-xs text-muted-foreground">Descrição escrita pelo vendedor.</p>
              </>
            ) : (
              listing.summary && (
                <p className="text-pretty text-muted-foreground">{listing.summary}</p>
              )
            )}
            {!listing.sellerDescription &&
              listing.summary &&
              listing.origin === "instagram" &&
              !listing.isClaimed && (
                <p className="text-xs text-muted-foreground">
                  Resumo automático do post; confira no original.
                </p>
              )}
            {listing.options.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1" aria-label="Destaques">
                {listing.options.map((option) => (
                  <li key={option}>
                    <Badge variant="secondary" className="h-7 px-3 text-sm font-normal">
                      {option}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <FactsTable listing={listing} now={now} />

          <section aria-labelledby="checar" className="flex flex-col gap-3">
            <h2 id="checar" className="text-xl font-semibold tracking-tight">
              {checklistTitle(listing.modelId)}
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground marker:text-primary">
              {checklistFor(listing).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Dúvidas sobre o modelo? Pergunte na comunidade{" "}
              <a
                href={MADE_BY_SWEDEN_URL}
                className="font-medium text-primary underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener"
              >
                Made by Sweden
              </a>
              .
            </p>
          </section>

          <SafetyTips compact />
        </div>

        <aside
          className="order-first flex flex-col gap-5 lg:sticky lg:top-20 lg:order-none lg:self-start"
          aria-label="Resumo e contato"
        >
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {listing.isClaimed && (
                <Badge className="gap-1">
                  <BadgeCheck aria-hidden />
                  Vendedor verificado
                </Badge>
              )}
              <Badge variant="outline">
                {listing.origin === "instagram" ? "Via Instagram" : "Cadastro direto"}
              </Badge>
              {listing.alerts.includes("repasse") && <RepasseBadge />}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Volvo {title}
            </h1>
            <p className="text-muted-foreground">
              {formatYears(listing.yearFab, listing.yearModel)} · {formatKm(listing.km)} ·{" "}
              {formatPlace(listing.city, listing.uf)}
            </p>
            <p className="pt-1 text-3xl font-semibold tracking-tight">
              {formatPrice(listing.priceCents)}
            </p>
          </div>

          <ListingAlerts alerts={listing.alerts} />

          <ContactActions listing={listing} />

          <p className="flex gap-2 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Anúncio de terceiro. O {site.name} não participa da negociação.</span>
          </p>

          <p className="text-sm text-muted-foreground">
            Este anúncio é seu?{" "}
            <Link
              href={`/anuncio/${listing.slug}/remover`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Remover
            </Link>{" "}
            |{" "}
            <Link
              href={`/anuncio/${listing.slug}/reivindicar`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Reivindicar
            </Link>
          </p>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similares" className="flex flex-col gap-4">
          <h2 id="similares" className="text-xl font-semibold tracking-tight">
            Outros {listing.modelName} à venda
          </h2>
          <ListingGrid listings={similar} now={now} />
        </section>
      )}
    </div>
  );
}

function StatusNotice({ listing }: { listing: ListingDetail }) {
  const text =
    listing.status === "sold"
      ? "Este carro foi marcado como vendido."
      : listing.status === "active"
        ? "Este anúncio veio de uma hashtag do Instagram há algumas semanas e pode não estar mais disponível. Confira o post original antes de entrar em contato."
        : "Este anúncio expirou e pode não estar mais disponível.";
  return (
    <p role="status" className="rounded-xl border border-border bg-secondary px-4 py-3 text-sm">
      {text}{" "}
      <Link
        href={landingPath({ modelId: listing.modelId })}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Ver outros {listing.modelName}
      </Link>
    </p>
  );
}

/**
 * Unclaimed listings: official Instagram embed / link with author credit (never our copy of the photos).
 * Claimed listings: the seller's licensed photos (Phase 6). Fixtures have neither.
 */
function MediaBlock({ listing }: { listing: ListingDetail }) {
  if (listing.isClaimed) {
    if (listing.photos.length > 0) {
      return <ListingGallery photos={listing.photos} title={`Volvo ${listingTitle(listing)}`} />;
    }
    return (
      <figure className="overflow-hidden rounded-2xl border border-border">
        <ModelPlate modelName={listing.modelName} className="aspect-[16/9]" />
        <figcaption className="px-4 py-3 text-sm text-muted-foreground">
          O vendedor ainda não enviou fotos.
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="overflow-hidden rounded-2xl border border-border">
      <ModelPlate modelName={listing.modelName} className="aspect-[16/9]" />
      <figcaption className="flex flex-col gap-1 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        {listing.sourcePermalink ? (
          <>
            <span>
              Fotos e texto completo no post original
              {listing.sourceUsername ? ` de @${listing.sourceUsername}` : ""}.
            </span>
            <a
              href={listing.sourcePermalink}
              target="_blank"
              rel="noopener nofollow"
              className="inline-flex items-center gap-1 font-medium text-primary"
            >
              Ver no Instagram <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </>
        ) : (
          <span>
            Prévia: aqui aparece o post original do Instagram (incorporação oficial), com crédito ao
            autor.
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function FactsTable({ listing, now }: { listing: ListingDetail; now: Date }) {
  const facts: Array<[string, string | null]> = [
    ["Ano", formatYears(listing.yearFab, listing.yearModel)],
    ["Quilometragem", formatKm(listing.km)],
    ["Motor", listing.engineName],
    ["Versão", listing.trimName ?? listing.versionText],
    ["Câmbio", listing.transmission ? TRANSMISSION_LABELS[listing.transmission] : null],
    ["Combustível", listing.fuel ? FUEL_LABELS[listing.fuel] : null],
    ["Cor", listing.color ? listing.color[0]!.toUpperCase() + listing.color.slice(1) : null],
    [
      "Local",
      listing.ufFromDdd && listing.uf
        ? `${listing.uf} (estado pelo DDD do telefone)`
        : formatPlace(listing.city, listing.uf),
    ],
    [
      "Vendedor",
      listing.sellerName ??
        (listing.sellerType === "loja"
          ? "Loja"
          : listing.sellerType === "particular"
            ? "Particular"
            : null),
    ],
    ["Publicado", formatRelativeDays(listing.firstSeenAt, now)],
  ];
  return (
    <section aria-labelledby="ficha" className="flex flex-col gap-3">
      <h2 id="ficha" className="text-xl font-semibold tracking-tight">
        Ficha
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-border p-5 sm:grid-cols-3">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

/**
 * Contact button: /r/<code> records the lead and redirects to WhatsApp (or to
 * Instagram when the post has no phone). The phone never reaches the HTML.
 * A plain <a> (not next/link) so nothing prefetches the click.
 */
const forAnalytics = (listing: ListingDetail): ListingForAnalytics => ({
  shortId: listing.shortId,
  title: `Volvo ${listingTitle(listing)}`,
  modelName: listing.modelName,
  engineName: listing.engineName,
  trimName: listing.trimName,
  uf: listing.uf,
  yearModel: listing.yearModel,
  priceCents: listing.priceCents,
});

function ContactActions({ listing }: { listing: ListingDetail }) {
  if (listing.status !== "active") return null;
  const hasInstagram = !!(
    listing.instagramUsername ||
    listing.sourceUsername ||
    listing.sourcePermalink
  );
  if (!listing.hasPhone && !hasInstagram) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-border bg-background/95 p-4 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
      <a
        href={`/r/${listing.shortId}`}
        rel="nofollow"
        aria-describedby="contato-nota"
        data-track="generate_lead"
        data-track-params={JSON.stringify(
          leadParams(forAnalytics(listing), listing.hasPhone ? "whatsapp" : "instagram"),
        )}
        className={cn(buttonVariants(), "h-12 w-full rounded-xl text-base")}
      >
        <MessageCircle aria-hidden />
        {listing.hasPhone
          ? "Falar com o vendedor no WhatsApp"
          : "Falar com o vendedor no Instagram"}
      </a>
      {listing.hasPhone && listing.sourcePermalink && (
        <a
          href={listing.sourcePermalink}
          target="_blank"
          rel="noopener nofollow"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary"
        >
          Ver no Instagram <ExternalLink className="size-4" aria-hidden />
        </a>
      )}
      <p id="contato-nota" className="text-center text-xs text-muted-foreground lg:text-left">
        Não guardamos dados seus neste clique.
      </p>
    </div>
  );
}

function DetailSkeleton() {
  // At least a screen tall: the footer must not show and then jump when the page streams in.
  return (
    <div
      className="mx-auto grid min-h-svh w-full max-w-6xl content-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_22rem]"
      aria-busy="true"
    >
      <Skeleton className="aspect-[16/9] rounded-2xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  );
}
