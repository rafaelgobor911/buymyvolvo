import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { TrackEvent } from "@/components/analytics/analytics";
import { ListingGrid } from "@/components/listing-card";
import { FiltersForm } from "@/components/search/filters-form";
import { FiltersSheet } from "@/components/search/filters-sheet";
import { InterpretedChips, Pagination, SortLinks } from "@/components/search/results-nav";
import { SearchBox } from "@/components/search/search-box";
import { Skeleton } from "@/components/ui/skeleton";
import { POPULAR_SEARCHES } from "@/content/popular";
import { formatInteger } from "@/lib/listings/format";
import { searchListings } from "@/lib/listings/queries";
import {
  describeFilters,
  type FilterChip,
  type RawParams,
  removeChipHref,
  resolveSearch,
} from "@/lib/search/filters";

/** Search terms go to Google Analytics: drop anything that looks like an e-mail or phone. */
const withoutContacts = (q: string) =>
  q
    .replace(/\S+@\S+/g, "")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "")
    .trim();

export async function generateMetadata(props: PageProps<"/busca">): Promise<Metadata> {
  const q = (await props.searchParams).q;
  const term = typeof q === "string" && q.trim() ? q.trim().slice(0, 60) : null;
  return {
    title: term ? `“${term}”: Volvo à venda` : "Buscar Volvo à venda",
    // The indexable form of model/version/state filters is /volvo/... (src/lib/seo/landing.ts).
    robots: { index: false, follow: true },
  };
}

export default function SearchPage(props: PageProps<"/busca">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <Suspense fallback={<ResultsSkeleton />}>
        <SearchResults searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchResults({ searchParams }: { searchParams: Promise<RawParams> }) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const filters = resolveSearch(params, { now });
  const chips = describeFilters(filters);
  const result = await searchListings(filters);

  return (
    <>
      {filters.q && (
        <TrackEvent
          name="search"
          id={filters.q}
          params={{ search_term: withoutContacts(filters.q), results: result.total }}
        />
      )}
      <div className="flex flex-col gap-4">
        <SearchBox defaultValue={filters.q} size="md" />
        <InterpretedChips chips={chips} params={params} filters={filters} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filtros">
          <div className="sticky top-20 rounded-2xl border border-border p-5">
            <FiltersForm filters={filters} idPrefix="desktop" />
          </div>
        </aside>

        <section aria-labelledby="resultados" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <h1
                id="resultados"
                className="text-lg font-semibold tracking-tight"
                aria-live="polite"
              >
                {result.total === 0
                  ? "Nenhum anúncio encontrado"
                  : `${formatInteger(result.total)} ${result.total === 1 ? "anúncio" : "anúncios"}`}
              </h1>
              <FiltersSheet activeCount={chips.length}>
                <FiltersForm filters={filters} idPrefix="mobile" />
              </FiltersSheet>
            </div>
            {result.total > 1 && <SortLinks params={params} current={filters.sort} />}
          </div>

          {result.total === 0 ? (
            <EmptyState chips={chips} params={params} />
          ) : (
            <>
              <ListingGrid listings={result.items} now={now} />
              <Pagination params={params} page={result.page} pageCount={result.pageCount} />
            </>
          )}
        </section>
      </div>
    </>
  );
}

function EmptyState({ chips, params }: { chips: FilterChip[]; params: RawParams }) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-dashed border-border p-6 sm:p-8">
      <p className="text-muted-foreground">
        Nenhum anúncio ativo combina com todos esses critérios agora. Tente afrouxar a busca:
      </p>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link
                href={removeChipHref(params, chip)}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm hover:border-primary/40 hover:bg-accent"
              >
                Sem “{chip.label}”
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">Ou experimente uma busca popular:</p>
        <ul className="flex flex-wrap gap-2">
          {POPULAR_SEARCHES.map((term) => (
            <li key={term}>
              <Link
                href={{ pathname: "/busca", query: { q: term.toLowerCase() } }}
                className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm hover:border-primary/40 hover:bg-accent"
              >
                {term}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm">
          <BellRing className="size-4 text-primary" aria-hidden />
          Quer ser avisado quando aparecer um carro assim?
        </p>
        <span className="text-sm text-muted-foreground">Alertas por e-mail em breve.</span>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando resultados">
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <Skeleton className="hidden h-[32rem] rounded-2xl lg:block" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
