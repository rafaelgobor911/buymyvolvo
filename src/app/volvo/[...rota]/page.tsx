import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";

import { JsonLd } from "@/components/json-ld";
import { ListingGrid } from "@/components/listing-card";
import { Skeleton } from "@/components/ui/skeleton";
import { checklistFor, MADE_BY_SWEDEN_URL } from "@/content/checklists";
import { landingText } from "@/content/landing-texts";
import { formatInteger, formatPrice } from "@/lib/listings/format";
import { searchListings, searchStats, type SearchStats } from "@/lib/listings/queries";
import { PAGE_SIZE, resolveSearch } from "@/lib/search/filters";
import { UFS } from "@/lib/search/places";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import {
  type Landing,
  LANDING_ROOT,
  landingIntro,
  landingPath,
  type LandingCount,
  minListingsToIndex,
  resolveLanding,
  UF_IN,
} from "@/lib/seo/landing";
import { activeLandingCounts } from "@/lib/seo/queries";
import { absoluteUrl } from "@/lib/site";

const loadStats = cache(async (path: string) => {
  // Request-time data (also reached from generateMetadata; parseQuery reads the clock).
  await connection();
  const resolved = resolveLanding(path.split("/").slice(2));
  if (resolved.kind !== "page") return null;
  return searchStats(resolveSearch(resolved.landing.searchParams));
});

const heading = (landing: Landing) =>
  `${landing.name} à venda${landing.where ? ` ${landing.where}` : ""}`;

function describe(landing: Landing, stats: SearchStats): string {
  const where = landing.where ? ` ${landing.where}` : " no Brasil";
  if (stats.total === 0) {
    return `${landing.name} seminovos e usados${where}: anúncios de lojas e particulares reunidos em um só lugar.`;
  }
  const count = `${formatInteger(stats.total)} ${stats.total === 1 ? "anúncio" : "anúncios"}`;
  const prices =
    stats.priced > 0 && stats.priceMinCents !== null && stats.priceMaxCents !== null
      ? stats.priceMinCents === stats.priceMaxCents
        ? ` Preço pedido: ${formatPrice(stats.priceMinCents)}.`
        : ` Preços pedidos de ${formatPrice(stats.priceMinCents)} a ${formatPrice(stats.priceMaxCents)}.`
      : "";
  return `${count} de ${landing.name} seminovos e usados${where}, de lojas e particulares.${prices}`;
}

export async function generateMetadata(props: PageProps<"/volvo/[...rota]">): Promise<Metadata> {
  const { rota } = await props.params;
  const resolved = resolveLanding(rota);
  // src/proxy.ts already answers 308/404 for these before the page streams.
  if (resolved.kind !== "page") return { title: "Página não encontrada", robots: { index: false } };
  const { landing } = resolved;
  const stats = await loadStats(landing.path);
  if (!stats) return { robots: { index: false } };
  const title = heading(landing);
  const description = describe(landing, stats);
  return {
    title,
    description,
    alternates: { canonical: landing.path },
    // Empty or thin combinations render for visitors but stay out of the index.
    robots:
      stats.total >= minListingsToIndex(landing.depth) ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website", url: landing.path },
  };
}

export default function LandingPage(props: PageProps<"/volvo/[...rota]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<LandingSkeleton />}>
        <LandingView params={props.params} />
      </Suspense>
    </div>
  );
}

async function LandingView({ params }: { params: Promise<{ rota: string[] }> }) {
  await connection();
  const { rota } = await params;
  const resolved = resolveLanding(rota);
  if (resolved.kind === "redirect") permanentRedirect(resolved.path);
  if (resolved.kind === "not_found") notFound();
  const { landing } = resolved;
  const filters = resolveSearch(landing.searchParams);
  const [stats, result, counts] = await Promise.all([
    loadStats(landing.path),
    searchListings(filters),
    activeLandingCounts(),
  ]);
  const now = new Date();
  const total = stats?.total ?? 0;
  const searchHref = { pathname: "/busca", query: landing.searchParams };
  const intro = landingIntro(landing);
  const editorial = landingText(landing.path);
  const crumbs = breadcrumbs(landing);
  const checklist = checklistFor({
    modelId: landing.model.id,
    engineId: landing.engine?.id ?? null,
    fuel: null,
    yearModel: stats?.yearMax ?? null,
  });

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(crumbs.map((c) => ({ name: c.label, url: absoluteUrl(c.path) })))}
      />
      <nav aria-label="Navegação estrutural" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          {crumbs.map((crumb, index) => (
            <li key={crumb.path} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden>/</span>}
              {index === crumbs.length - 1 ? (
                <span aria-current="page" className="text-foreground">
                  {crumb.short}
                </span>
              ) : (
                <Link href={crumb.path} className="hover:text-foreground">
                  {crumb.short}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {heading(landing)}
        </h1>
        <p className="text-lg text-muted-foreground">
          {total === 0
            ? "Nenhum anúncio ativo agora."
            : `${formatInteger(total)} ${total === 1 ? "anúncio ativo" : "anúncios ativos"} de lojas e particulares${
                stats?.yearMin && stats.yearMax
                  ? stats.yearMin === stats.yearMax
                    ? `, ano-modelo ${stats.yearMin}`
                    : `, anos-modelo de ${stats.yearMin} a ${stats.yearMax}`
                  : ""
              }.`}
        </p>
      </header>

      {stats && <PriceSummary stats={stats} />}

      <section aria-labelledby="anuncios" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="anuncios" className="text-xl font-semibold tracking-tight">
            Anúncios
          </h2>
          {total > 0 && (
            <Link
              href={searchHref}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              {total > PAGE_SIZE ? `Ver os ${formatInteger(total)} na busca` : "Filtrar na busca"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
        {result.items.length > 0 ? (
          <ListingGrid listings={result.items} now={now} />
        ) : (
          <EmptyState landing={landing} />
        )}
      </section>

      <FacetLinks landing={landing} counts={counts} />

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="sobre-modelo" className="flex flex-col gap-3">
          <h2 id="sobre-modelo" className="text-xl font-semibold tracking-tight">
            Sobre o {landing.model.name}
          </h2>
          {intro.paragraphs.map((p) => (
            <p key={p} className="text-pretty text-muted-foreground">
              {p}
            </p>
          ))}
          {editorial && <p className="text-pretty text-muted-foreground">{editorial}</p>}
          {intro.related.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-1">
              {intro.related.map((link) => (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm hover:border-primary/40 hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="checar" className="flex flex-col gap-3">
          <h2 id="checar" className="text-xl font-semibold tracking-tight">
            O que checar antes de comprar
          </h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground marker:text-primary">
            {checklist.map((item) => (
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
      </div>
    </>
  );
}

/** Asking-price range from our own active listings (not a market reference). */
function PriceSummary({ stats }: { stats: SearchStats }) {
  if (stats.priced === 0 || stats.priceMinCents === null || stats.priceMaxCents === null) {
    return null;
  }
  const single = stats.priceMinCents === stats.priceMaxCents;
  return (
    <section
      aria-labelledby="precos"
      className="flex flex-col gap-3 rounded-2xl border border-border p-5 sm:p-6"
    >
      <h2 id="precos" className="text-sm font-medium text-muted-foreground">
        {single ? "Preço pedido" : "Faixa de preços pedidos"}
      </h2>
      <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {single
          ? formatPrice(stats.priceMinCents)
          : `${formatPrice(stats.priceMinCents)} a ${formatPrice(stats.priceMaxCents)}`}
      </p>
      {stats.priced >= 3 && stats.priceMedianCents !== null && (
        <p className="text-muted-foreground">
          Metade dos anúncios pede até {formatPrice(stats.priceMedianCents)}.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Calculado com {formatInteger(stats.priced)}{" "}
        {stats.priced === 1 ? "anúncio ativo" : "anúncios ativos"} com preço neste site, sem
        repasses. É o preço que os vendedores pedem, não uma tabela de referência (como a FIPE).
      </p>
    </section>
  );
}

function EmptyState({ landing }: { landing: Landing }) {
  const broader = landing.depth > 1 ? landingPath({ modelId: landing.model.id }) : LANDING_ROOT;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-6 sm:p-8">
      <p className="text-muted-foreground">
        Nenhum {landing.name} ativo{landing.where ? ` ${landing.where}` : ""} no momento. Os
        anúncios entram e saem todos os dias.
      </p>
      <p>
        <Link
          href={broader}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {landing.depth > 1 ? `Ver todos os ${landing.model.name}` : "Ver outros modelos"}
        </Link>
      </p>
    </div>
  );
}

/** Internal links to the versions and states that have active listings. */
function FacetLinks({ landing, counts }: { landing: Landing; counts: LandingCount[] }) {
  const sameModel = counts.filter((c) => c.modelId === landing.model.id);
  const version = landing.engine?.id ?? landing.trim?.id;
  const versions = sameModel
    .filter((c) => (c.engineId ?? c.trimId) && c.uf === landing.uf && c.path !== landing.path)
    .sort((a, b) => b.count - a.count);
  const states = sameModel
    .filter((c) => c.uf && (c.engineId ?? c.trimId) === version && c.path !== landing.path)
    .sort((a, b) => b.count - a.count);
  if (!versions.length && !states.length) return null;
  const chip = (c: LandingCount, label: string) => (
    <li key={c.path}>
      <Link
        href={c.path}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm hover:border-primary/40 hover:bg-accent"
      >
        {label}
        <span className="text-muted-foreground">{formatInteger(c.count)}</span>
      </Link>
    </li>
  );
  const versionLabel = (c: LandingCount) => {
    const resolved = resolveLanding(c.path.split("/").slice(2));
    return resolved.kind === "page"
      ? resolved.landing.name.replace(`Volvo ${landing.model.name} `, "")
      : c.path;
  };
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      {versions.length > 0 && (
        <section aria-labelledby="por-versao" className="flex flex-col gap-3">
          <h2 id="por-versao" className="text-lg font-semibold tracking-tight">
            {landing.model.name} por versão{landing.uf ? ` ${UF_IN[landing.uf]}` : ""}
          </h2>
          <ul className="flex flex-wrap gap-2">{versions.map((c) => chip(c, versionLabel(c)))}</ul>
        </section>
      )}
      {states.length > 0 && (
        <section aria-labelledby="por-estado" className="flex flex-col gap-3">
          <h2 id="por-estado" className="text-lg font-semibold tracking-tight">
            {landing.name.replace("Volvo ", "")} por estado
          </h2>
          <ul className="flex flex-wrap gap-2">{states.map((c) => chip(c, UFS[c.uf!]))}</ul>
        </section>
      )}
    </div>
  );
}

interface Crumb {
  path: string;
  /** Full name, for the structured data. */
  label: string;
  /** Short label for the visible trail. */
  short: string;
}

function breadcrumbs(landing: Landing): Crumb[] {
  const crumbs: Crumb[] = [
    { path: LANDING_ROOT, label: "Volvo à venda", short: "Volvo à venda" },
    {
      path: landingPath({ modelId: landing.model.id }),
      label: `Volvo ${landing.model.name}`,
      short: landing.model.name,
    },
  ];
  const version = landing.engine ?? landing.trim;
  if (version) {
    crumbs.push({
      path: landingPath({
        modelId: landing.model.id,
        engineId: landing.engine?.id,
        trimId: landing.trim?.id,
      }),
      label: `Volvo ${landing.model.name} ${version.name}`,
      short: version.name,
    });
  }
  if (landing.uf) {
    crumbs.push({ path: landing.path, label: heading(landing), short: UFS[landing.uf] });
  }
  return crumbs;
}

function LandingSkeleton() {
  return (
    <div className="flex min-h-svh flex-col gap-8" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-10 w-3/4 max-w-xl" />
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
