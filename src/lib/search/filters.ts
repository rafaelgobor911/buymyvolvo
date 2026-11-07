/**
 * Resolves the effective search filters from the URL:
 *   q            free text, parsed by parseQuery
 *   explicit     params from the filter panel; when present (even empty) they
 *                override what was parsed from q for that dimension
 * Pure and client-safe: used by server pages and by components building links.
 */
import {
  ENGINES,
  FUEL_LABELS,
  FUELS,
  type Fuel,
  getEngine,
  getModel,
  getTrim,
  MODELS,
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
  type Transmission,
  TRIMS,
  variantsOf,
} from "@/lib/taxonomy";

import { parseQuery, type SearchSellerType } from "./parse-query";
import { isUf, type Uf, UFS } from "./places";

export const SORTS = {
  recentes: "Mais recentes",
  "menor-preco": "Menor preço",
  "menor-km": "Menor km",
} as const;
export type Sort = keyof typeof SORTS;

export const PAGE_SIZE = 24;

export const PARAM = {
  q: "q",
  model: "modelo",
  engine: "motor",
  trim: "versao",
  fuel: "combustivel",
  transmission: "cambio",
  seller: "vendedor",
  yearMin: "ano_min",
  yearMax: "ano_max",
  priceMin: "preco_min",
  priceMax: "preco_max",
  kmMax: "km_max",
  uf: "uf",
  city: "cidade",
  text: "texto",
  sort: "ordem",
  page: "pagina",
} as const;

export type RawParams = Record<string, string | string[] | undefined>;

export interface SearchFilters {
  q: string;
  modelIds: string[];
  engineIds: string[];
  trimIds: string[];
  fuels: Fuel[];
  transmission?: Transmission;
  sellerType?: SearchSellerType;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  kmMax?: number;
  uf?: Uf;
  city?: string;
  text: string;
  sort: Sort;
  page: number;
  citySuggestion?: { city: string; uf: Uf };
  warnings: string[];
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const has = (params: RawParams, key: string) => first(params[key]) !== undefined;
const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const MODEL_IDS = new Set(MODELS.map((m) => m.id));
const ENGINE_IDS = new Set(ENGINES.map((e) => e.id));
const TRIM_IDS = new Set(TRIMS.map((t) => t.id));

function positiveInt(v: string | undefined, max = 100_000_000): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : undefined;
}

/** A base model selected explicitly also brings its variants (V40 → V40 Cross Country). */
function expandModels(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (!out.includes(id)) out.push(id);
    for (const v of variantsOf(id)) if (!out.includes(v.id)) out.push(v.id);
  }
  return out;
}

export function resolveSearch(params: RawParams, options: { now?: Date } = {}): SearchFilters {
  const q = (first(params[PARAM.q]) ?? "").trim().slice(0, 200);
  const parsed = parseQuery(q, options);
  const get = (key: string) => first(params[key]);
  const pick = <T>(key: string, explicit: () => T, fallback: T): T =>
    has(params, key) ? explicit() : fallback;

  const sort = get(PARAM.sort);
  const transmission = get(PARAM.transmission);
  const seller = get(PARAM.seller);
  const uf = get(PARAM.uf)?.toUpperCase();
  const city = get(PARAM.city)?.trim();
  const yearMin = pick(PARAM.yearMin, () => positiveInt(get(PARAM.yearMin), 2100), parsed.yearMin);
  const yearMax = pick(PARAM.yearMax, () => positiveInt(get(PARAM.yearMax), 2100), parsed.yearMax);

  const filters: SearchFilters = {
    q,
    modelIds: pick(
      PARAM.model,
      () => expandModels(list(get(PARAM.model)).filter((id) => MODEL_IDS.has(id))),
      parsed.modelIds,
    ),
    engineIds: pick(
      PARAM.engine,
      () => list(get(PARAM.engine)).filter((id) => ENGINE_IDS.has(id)),
      parsed.engineIds,
    ),
    trimIds: pick(
      PARAM.trim,
      () => list(get(PARAM.trim)).filter((id) => TRIM_IDS.has(id)),
      parsed.trimIds,
    ),
    fuels: pick(
      PARAM.fuel,
      () =>
        list(get(PARAM.fuel)).filter((f): f is Fuel => (FUELS as readonly string[]).includes(f)),
      parsed.fuels,
    ),
    transmission: pick(
      PARAM.transmission,
      () =>
        (TRANSMISSIONS as readonly string[]).includes(transmission ?? "")
          ? (transmission as Transmission)
          : undefined,
      parsed.transmission,
    ),
    sellerType: pick(
      PARAM.seller,
      () => (seller === "loja" || seller === "particular" ? seller : undefined),
      parsed.sellerType,
    ),
    yearMin,
    yearMax,
    priceMin: pick(PARAM.priceMin, () => positiveInt(get(PARAM.priceMin)), parsed.priceMin),
    priceMax: pick(PARAM.priceMax, () => positiveInt(get(PARAM.priceMax)), parsed.priceMax),
    kmMax: pick(PARAM.kmMax, () => positiveInt(get(PARAM.kmMax), 2_000_000), parsed.kmMax),
    uf: pick(PARAM.uf, () => (uf && isUf(uf) ? uf : undefined), parsed.uf),
    city: pick(PARAM.city, () => (city ? city.slice(0, 80) : undefined), parsed.city),
    text: pick(PARAM.text, () => (get(PARAM.text) ?? "").trim().slice(0, 100), parsed.text),
    sort: sort && sort in SORTS ? (sort as Sort) : "recentes",
    page: Math.min(positiveInt(get(PARAM.page), 10_000) ?? 1, 10_000),
    warnings: parsed.warnings,
  };

  // An explicit state that differs from the parsed city drops the city.
  if (
    has(params, PARAM.uf) &&
    !has(params, PARAM.city) &&
    filters.city &&
    parsed.uf !== filters.uf
  ) {
    filters.city = undefined;
  }
  if (!filters.city && parsed.citySuggestion && filters.uf === parsed.citySuggestion.uf) {
    filters.citySuggestion = parsed.citySuggestion;
  }
  return filters;
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/** Builds /busca?… from the current raw params plus changes (null deletes, "" = explicit "any"). */
export function searchHref(current: RawParams, changes: Record<string, string | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const v = first(value);
    if (v !== undefined) params.set(key, v);
  }
  if (!(PARAM.page in changes)) params.delete(PARAM.page);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `/busca?${query}` : "/busca";
}

// ---------------------------------------------------------------------------
// Human-readable chips ("Entendemos: S60 · T5 · 2019")
// ---------------------------------------------------------------------------

export interface FilterChip {
  key: string;
  label: string;
  param: string;
}

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
const int = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export function modelGroupLabel(ids: string[]): string {
  const base = ids.find((id) =>
    ids.every((other) => other === id || getModel(other)?.parentId === id),
  );
  if (base && ids.length > 1) return `${getModel(base)?.name} (inclui Cross Country)`;
  return ids.map((id) => getModel(id)?.name ?? id).join(" / ");
}

export function describeFilters(f: SearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.modelIds.length)
    chips.push({ key: "model", label: modelGroupLabel(f.modelIds), param: PARAM.model });
  if (f.engineIds.length) {
    chips.push({
      key: "engine",
      label: f.engineIds.map((id) => getEngine(id)?.name ?? id).join(" / "),
      param: PARAM.engine,
    });
  }
  if (f.trimIds.length) {
    chips.push({
      key: "trim",
      label: f.trimIds.map((id) => getTrim(id)?.name ?? id).join(" ou "),
      param: PARAM.trim,
    });
  }
  if (f.fuels.length) {
    chips.push({
      key: "fuel",
      label: f.fuels.map((x) => FUEL_LABELS[x]).join(" ou "),
      param: PARAM.fuel,
    });
  }
  if (f.transmission) {
    chips.push({
      key: "transmission",
      label: TRANSMISSION_LABELS[f.transmission],
      param: PARAM.transmission,
    });
  }
  if (f.sellerType) {
    chips.push({
      key: "seller",
      label: f.sellerType === "loja" ? "Loja" : "Particular",
      param: PARAM.seller,
    });
  }
  if (f.yearMin !== undefined && f.yearMin === f.yearMax) {
    chips.push({
      key: "year",
      label: `Ano ${f.yearMin}`,
      param: `${PARAM.yearMin},${PARAM.yearMax}`,
    });
  } else {
    if (f.yearMin !== undefined)
      chips.push({ key: "yearMin", label: `A partir de ${f.yearMin}`, param: PARAM.yearMin });
    if (f.yearMax !== undefined)
      chips.push({ key: "yearMax", label: `Até ${f.yearMax}`, param: PARAM.yearMax });
  }
  if (f.priceMin !== undefined)
    chips.push({ key: "priceMin", label: `A partir de ${brl(f.priceMin)}`, param: PARAM.priceMin });
  if (f.priceMax !== undefined)
    chips.push({ key: "priceMax", label: `Até ${brl(f.priceMax)}`, param: PARAM.priceMax });
  if (f.kmMax !== undefined)
    chips.push({ key: "kmMax", label: `Até ${int(f.kmMax)} km`, param: PARAM.kmMax });
  if (f.city)
    chips.push({
      key: "city",
      label: f.uf ? `${f.city}, ${f.uf}` : f.city,
      param: `${PARAM.city},${PARAM.uf}`,
    });
  else if (f.uf) chips.push({ key: "uf", label: `${UFS[f.uf]} (${f.uf})`, param: PARAM.uf });
  if (f.text) chips.push({ key: "text", label: `“${f.text}”`, param: PARAM.text });
  return chips;
}

/** Link that removes one chip (sets its params to explicit "any"). */
export function removeChipHref(current: RawParams, chip: FilterChip): string {
  return searchHref(current, Object.fromEntries(chip.param.split(",").map((p) => [p, ""])));
}
