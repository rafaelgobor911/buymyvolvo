import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";

import {
  type FilterChip,
  PARAM,
  type RawParams,
  removeChipHref,
  searchHref,
  type SearchFilters,
  SORTS,
  type Sort,
} from "@/lib/search/filters";
import { cn } from "@/lib/utils";

export function InterpretedChips({
  chips,
  params,
  filters,
}: {
  chips: FilterChip[];
  params: RawParams;
  filters: SearchFilters;
}) {
  if (chips.length === 0 && !filters.citySuggestion && filters.warnings.length === 0) return null;
  const understood = chips.filter((c) => c.key !== "text");
  const text = chips.find((c) => c.key === "text");
  return (
    <div className="flex flex-col gap-2">
      {understood.length > 0 && <ChipRow label="Entendemos:" chips={understood} params={params} />}
      {/* Words the search did not recognize go to full-text search: say so, not "understood". */}
      {text && <ChipRow label="Também buscamos o texto:" chips={[text]} params={params} />}
      {filters.citySuggestion && (
        <p className="text-sm text-muted-foreground">
          Buscando no estado inteiro.{" "}
          <Link
            className="font-medium text-primary underline-offset-4 hover:underline"
            href={searchHref(params, {
              [PARAM.city]: filters.citySuggestion.city,
              [PARAM.uf]: filters.citySuggestion.uf,
            })}
          >
            Ver só a cidade de {filters.citySuggestion.city}
          </Link>
        </p>
      )}
      {filters.warnings.map((w) => (
        <p key={w} className="text-sm text-muted-foreground">
          {w}
        </p>
      ))}
    </div>
  );
}

function ChipRow({
  label,
  chips,
  params,
}: {
  label: string;
  chips: FilterChip[];
  params: RawParams;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={removeChipHref(params, chip)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-accent pr-2.5 pl-3 text-sm text-accent-foreground transition-colors hover:bg-accent/70 sm:h-8"
              aria-label={`Remover filtro: ${chip.label}`}
            >
              {chip.label}
              <X className="size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SortLinks({ params, current }: { params: RawParams; current: Sort }) {
  return (
    <nav
      aria-label="Ordenar resultados"
      className="-mx-1 flex items-center gap-1 overflow-x-auto text-sm whitespace-nowrap"
    >
      <span className="mr-1 hidden text-muted-foreground sm:inline">Ordenar:</span>
      {(Object.keys(SORTS) as Sort[]).map((sort) => (
        <Link
          key={sort}
          href={searchHref(params, { [PARAM.sort]: sort === "recentes" ? null : sort })}
          aria-current={sort === current ? "true" : undefined}
          className={cn(
            "inline-flex h-11 items-center rounded-md px-2.5 transition-colors sm:h-8",
            sort === current
              ? "bg-secondary font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {SORTS[sort]}
        </Link>
      ))}
    </nav>
  );
}

function pageWindow(page: number, pageCount: number): Array<number | "…"> {
  const pages = new Set(
    [1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount),
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function Pagination({
  params,
  page,
  pageCount,
}: {
  params: RawParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => searchHref(params, { [PARAM.page]: p === 1 ? null : String(p) });
  const linkClass =
    "inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm sm:h-10 sm:min-w-10 transition-colors hover:bg-secondary";
  return (
    <nav aria-label="Paginação" className="flex items-center justify-center gap-1 pt-4">
      {page > 1 && (
        <Link href={href(page - 1)} className={linkClass} rel="prev" aria-label="Página anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      )}
      {pageWindow(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              linkClass,
              p === page && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount && (
        <Link href={href(page + 1)} className={linkClass} rel="next" aria-label="Próxima página">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
