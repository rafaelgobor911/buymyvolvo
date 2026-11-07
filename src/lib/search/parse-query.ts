/**
 * Deterministic free-text → filters parser (no AI, no DB).
 *
 * Pipeline:
 *  1. Fold text (lowercase, no accents) keeping the original alongside, same length.
 *  2. Regex pass for numbers with meaning: km, years, prices. Matched spans are blanked.
 *  3. Tokenize what is left and run a small dynamic program over n-grams (up to 5
 *     tokens) against an alias dictionary built from the taxonomy and the gazetteer.
 *     Glued tokens such as "s60t5" are segmented into known aliases.
 *  4. Post-process: model variants and renames, ambiguous trims, places.
 * Whatever is not understood goes to `text` (full-text search).
 */
import {
  aliasKey,
  describeBrazilOffers,
  ENGINES,
  type Fuel,
  getEngine,
  getModel,
  getTrim,
  isEngineCompatible,
  isEngineOfferedInBrazil,
  isTrimCompatible,
  MODELS,
  TRIMS,
  type Transmission,
  trimVariantsOf,
  variantsOf,
} from "@/lib/taxonomy";

import {
  AMBIGUOUS_UFS,
  CITIES,
  CITY_STATE_HOMONYMS,
  STATE_ALIASES,
  type Uf,
  UF_CODES,
  UFS,
} from "./places";

export type SearchSellerType = "loja" | "particular";

export interface ParsedQuery {
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
  kmMin?: number;
  kmMax?: number;
  uf?: Uf;
  city?: string;
  /** Narrower reading offered in the UI, e.g. "são paulo" → state SP, suggest the city. */
  citySuggestion?: { city: string; uf: Uf };
  /** Leftover words for full-text search. */
  text: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Dictionary
// ---------------------------------------------------------------------------

type Entry =
  | { kind: "model"; id: string }
  | { kind: "engine"; id: string }
  | { kind: "trim"; id: string }
  | { kind: "fuel"; fuels: Fuel[] }
  | { kind: "transmission"; value: Transmission }
  | { kind: "seller"; value: SearchSellerType }
  | { kind: "uf"; uf: Uf; ambiguous: boolean }
  | { kind: "city"; city: string; uf: Uf }
  | { kind: "homonym"; city: string; uf: Uf }
  | { kind: "cityHint" }
  | { kind: "capitalHint" }
  | { kind: "stop" };

const TAXONOMY_KINDS = new Set<Entry["kind"]>(["model", "engine", "trim", "fuel"]);

const FUEL_PHRASES: Array<[string[], Fuel[]]> = [
  [
    [
      "eletrico",
      "eletrica",
      "eletricos",
      "eletricas",
      "ev",
      "bev",
      "pure electric",
      "puro eletrico",
    ],
    ["eletrico"],
  ],
  [["recharge"], ["hibrido_plugin", "eletrico"]],
  [
    ["hibrido", "hibrida", "hibridos", "hybrid"],
    ["hibrido_leve", "hibrido_plugin"],
  ],
  [
    ["hibrido plug-in", "hibrido plugin", "plug-in", "plugin", "phev", "twin engine"],
    ["hibrido_plugin"],
  ],
  [["hibrido leve", "mild hybrid", "mhev", "48v"], ["hibrido_leve"]],
  [["diesel"], ["diesel"]],
  [["gasolina"], ["gasolina"]],
];

const TRANSMISSION_PHRASES: Array<[string[], Transmission]> = [
  [["manual", "cambio manual"], "manual"],
  [
    [
      "automatico",
      "automatica",
      "automaticos",
      "automatizado",
      "aut",
      "auto",
      "at",
      "geartronic",
      "cambio automatico",
    ],
    "automatico",
  ],
];

const SELLER_PHRASES: Array<[string[], SearchSellerType]> = [
  [
    [
      "loja",
      "lojas",
      "lojista",
      "lojistas",
      "concessionaria",
      "concessionarias",
      "revenda",
      "revendedora",
      "garagem",
    ],
    "loja",
  ],
  [
    [
      "particular",
      "particulares",
      "proprietario",
      "direto com o dono",
      "direto com dono",
      "direto do dono",
      "direto com proprietario",
    ],
    "particular",
  ],
];

const STOPWORDS = [
  "volvo",
  "volvos",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "com",
  "e",
  "ou",
  "a",
  "o",
  "os",
  "as",
  "um",
  "uma",
  "para",
  "pra",
  "por",
  "se",
  "que",
  "carro",
  "carros",
  "vendo",
  "venda",
  "vende",
  "usado",
  "usados",
  "usada",
  "seminovo",
  "seminovos",
  "seminova",
  "anuncio",
  "anuncios",
  "quero",
  "procuro",
  "busco",
  "modelo",
  "versao",
  "motor",
  "ano",
  "cambio",
  "estado",
  "regiao",
  "perto",
  "km",
  "reais",
];

const DICT = new Map<string, Entry[]>();

function addEntry(phrase: string, entry: Entry) {
  const key = aliasKey(phrase);
  if (!key) return;
  const list = DICT.get(key) ?? [];
  const signature = JSON.stringify(entry);
  if (!list.some((e) => JSON.stringify(e) === signature)) list.push(entry);
  DICT.set(key, list);
}

for (const m of MODELS) {
  for (const a of [m.name, m.id, ...m.aliases]) addEntry(a, { kind: "model", id: m.id });
}
for (const e of ENGINES) {
  for (const a of [e.name, e.id, ...e.aliases]) addEntry(a, { kind: "engine", id: e.id });
}
for (const t of TRIMS) {
  for (const a of [t.name, t.id, ...t.aliases]) addEntry(a, { kind: "trim", id: t.id });
}
for (const [phrases, fuels] of FUEL_PHRASES) {
  for (const p of phrases) addEntry(p, { kind: "fuel", fuels });
}
for (const [phrases, value] of TRANSMISSION_PHRASES) {
  for (const p of phrases) addEntry(p, { kind: "transmission", value });
}
for (const [phrases, value] of SELLER_PHRASES) {
  for (const p of phrases) addEntry(p, { kind: "seller", value });
}
for (const uf of UF_CODES) {
  const code = uf.toLowerCase();
  addEntry(code, { kind: "uf", uf, ambiguous: AMBIGUOUS_UFS.has(code) });
  const name = aliasKey(UFS[uf]);
  // "Pará" folds to "para" (a preposition); SP/RJ names are city/state homonyms.
  if (uf !== "PA" && !(name in homonymKeys()))
    addEntry(UFS[uf], { kind: "uf", uf, ambiguous: false });
}
for (const [phrase, uf] of Object.entries(STATE_ALIASES)) {
  addEntry(phrase, { kind: "uf", uf, ambiguous: false });
}
for (const [phrase, { city, uf }] of Object.entries(CITY_STATE_HOMONYMS)) {
  addEntry(phrase, { kind: "homonym", city, uf });
}
for (const c of CITIES) {
  const isHomonym = aliasKey(c.name) in homonymKeys();
  if (!isHomonym) addEntry(c.name, { kind: "city", city: c.name, uf: c.uf });
  for (const a of c.aliases ?? []) addEntry(a, { kind: "city", city: c.name, uf: c.uf });
}
addEntry("cidade", { kind: "cityHint" });
addEntry("capital", { kind: "capitalHint" });
for (const w of STOPWORDS) addEntry(w, { kind: "stop" });

function homonymKeys(): Record<string, true> {
  return Object.fromEntries(Object.keys(CITY_STATE_HOMONYMS).map((k) => [aliasKey(k), true]));
}

/** Capital city of each UF (first gazetteer entry for the UF is its capital). */
const CAPITALS = new Map<Uf, string>();
for (const c of CITIES) if (!CAPITALS.has(c.uf)) CAPITALS.set(c.uf, c.name);

// ---------------------------------------------------------------------------
// Text folding (same length as the input so spans map back to the original)
// ---------------------------------------------------------------------------

function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const folded = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    out += folded.length === ch.length ? folded : ch;
  }
  return out;
}

class Work {
  text: string;
  constructor(text: string) {
    this.text = text;
  }

  /** Runs `handler` for each match; when it returns true the span is blanked. */
  consume(pattern: RegExp, handler: (m: RegExpExecArray) => boolean) {
    const snapshot = this.text;
    for (const m of snapshot.matchAll(pattern)) {
      if (handler(m as RegExpExecArray)) this.blank(m.index ?? 0, m[0].length);
    }
  }

  private blank(start: number, length: number) {
    this.text = this.text.slice(0, start) + " ".repeat(length) + this.text.slice(start + length);
  }
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const MULTIPLIERS: Record<string, number> = {
  mil: 1_000,
  k: 1_000,
  mi: 1_000_000,
  milhao: 1_000_000,
  milhoes: 1_000_000,
};

/** Parses Brazilian-formatted numbers: "189.900,00", "58.000", "1,5", "200". */
export function parseBrazilianNumber(raw: string): number | undefined {
  let s = raw.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function amount(raw: string, multiplier?: string): number | undefined {
  const n = parseBrazilianNumber(raw);
  if (n === undefined) return undefined;
  return Math.round(n * (multiplier ? (MULTIPLIERS[multiplier] ?? 1) : 1));
}

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?`;
const LB = String.raw`(?<![a-z0-9$.,])`; // left boundary: not glued to a word ("s60", "t5")
const MULT = String.raw`(?:milhoes|milhao|mil|mi|k)`;
const KM_UNIT = String.raw`(?:km|kms|quilometros?|quilometragem)`;
const MAX_Q = String.raw`(?:ate|maximo|max|no maximo|abaixo de|menos de|com ate|com menos de|por ate|por menos de|inferior a)`;
const MIN_Q = String.raw`(?:acima de|mais de|a partir de|minimo|no minimo|superior a)`;
const YEAR = String.raw`(?:19[7-9]\d|20[0-4]\d)`;
const NOT_UNIT = String.raw`(?![a-z0-9.,])(?!\s*(?:mil|k\b|km|kms|quilometr|reais))`;

const isMaxQualifier = (q: string | undefined) => !!q && new RegExp(`^${MAX_Q}$`).test(q);

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export interface ParseOptions {
  now?: Date;
}

const MAX_NGRAM = 5;

export function parseQuery(input: string, options: ParseOptions = {}): ParsedQuery {
  const maxYear = (options.now ?? new Date()).getFullYear() + 1;
  const original = (input ?? "").normalize("NFC").slice(0, 300);
  const work = new Work(fold(original));

  const result: ParsedQuery = {
    modelIds: [],
    engineIds: [],
    trimIds: [],
    fuels: [],
    text: "",
    warnings: [],
  };
  const validYear = (y: number) => y >= 1970 && y <= maxYear;
  const years: number[] = [];

  // "100% elétrico": drop the percentage so it is not read as a number.
  work.consume(/(?<![a-z0-9])100\s*%/g, () => true);

  // --- km ------------------------------------------------------------------
  work.consume(
    new RegExp(
      String.raw`(?:\b(${MAX_Q}|${MIN_Q})\s+)?${LB}(${NUM})\s*(mil|k)?\s*${KM_UNIT}(?![a-z])`,
      "g",
    ),
    (m) => {
      const value = amount(m[2]!, m[3]);
      if (value === undefined) return false;
      if (m[1] && !isMaxQualifier(m[1])) result.kmMin = value;
      else result.kmMax = value;
      return true;
    },
  );
  work.consume(
    new RegExp(
      String.raw`\b${KM_UNIT}\s+(${MAX_Q}|${MIN_Q})\s+${LB}(${NUM})\s*(mil|k)?(?![a-z0-9])`,
      "g",
    ),
    (m) => {
      const value = amount(m[2]!, m[3]);
      if (value === undefined) return false;
      if (isMaxQualifier(m[1])) result.kmMax = value;
      else result.kmMin = value;
      return true;
    },
  );

  // --- years ---------------------------------------------------------------
  work.consume(
    new RegExp(
      String.raw`(?:\b(?:de|entre|do)\s+)?${LB}(${YEAR})\s*(?:-|a|ate|e|ao)\s*(${YEAR})${NOT_UNIT}`,
      "g",
    ),
    (m) => {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (!validYear(a) || !validYear(b)) return false;
      result.yearMin = Math.min(a, b);
      result.yearMax = Math.max(a, b);
      return true;
    },
  );
  // Fab/model "19/20", "2019/2020": filter by the model year.
  work.consume(
    new RegExp(String.raw`${LB}(\d{2}|\d{4})\s*\/\s*(\d{2}|\d{4})(?![a-z0-9])`, "g"),
    (m) => {
      const raw = m[2]!;
      const year =
        raw.length === 2 ? (Number(raw) <= maxYear % 100 ? 2000 : 1900) + Number(raw) : Number(raw);
      if (!validYear(year)) return false;
      result.yearMin = year;
      result.yearMax = year;
      return true;
    },
  );
  work.consume(
    new RegExp(
      String.raw`\b(ate|antes de|abaixo de|a partir de|acima de|desde|depois de|apos|mais novos? que|no minimo|minimo|maximo)\s+(?:(?:o\s+)?ano\s+(?:de\s+)?)?${LB}(${YEAR})${NOT_UNIT}`,
      "g",
    ),
    (m) => {
      const q = m[1]!;
      const y = Number(m[2]);
      if (!validYear(y)) return false;
      if (q === "ate" || q === "abaixo de" || q === "maximo") result.yearMax = y;
      else if (q === "antes de") result.yearMax = y - 1;
      else if (q === "depois de" || q === "apos") result.yearMin = y + 1;
      else result.yearMin = y;
      return true;
    },
  );
  work.consume(
    new RegExp(String.raw`${LB}(${YEAR})\s*(?:\+|em diante|pra cima|para cima|ou mais novo)`, "g"),
    (m) => {
      const y = Number(m[1]);
      if (!validYear(y)) return false;
      result.yearMin = y;
      return true;
    },
  );
  work.consume(new RegExp(String.raw`${LB}(${YEAR})${NOT_UNIT}`, "g"), (m) => {
    const y = Number(m[1]);
    if (!validYear(y)) return false;
    years.push(y);
    return true;
  });
  if (years.length > 0 && result.yearMin === undefined && result.yearMax === undefined) {
    result.yearMin = Math.min(...years);
    result.yearMax = Math.max(...years);
  }

  // --- prices --------------------------------------------------------------
  const PRICE_NUM = String.raw`(?:r\$\s*)?(?<![a-z0-9.,])(${NUM})\s*(${MULT})?(?![a-z0-9])`;
  const NOT_KM = String.raw`(?!\s*${KM_UNIT})`;
  work.consume(
    new RegExp(
      String.raw`\b(?:de|entre)\s+${PRICE_NUM}\s+(?:a|e|ate)\s+${PRICE_NUM}${NOT_KM}`,
      "g",
    ),
    (m) => {
      const hasCurrency = m[0].includes("r$");
      const multB = m[4];
      const multA = m[2] ?? (multB && Number(m[1]) < Number(m[3]) ? multB : undefined);
      const a = amount(m[1]!, multA);
      const b = amount(m[3]!, multB);
      if (a === undefined || b === undefined) return false;
      if (!hasCurrency && !multA && !multB && Math.max(a, b) < 1_000) return false;
      result.priceMin = Math.min(a, b);
      result.priceMax = Math.max(a, b);
      return true;
    },
  );
  work.consume(new RegExp(String.raw`\b(${MAX_Q}|${MIN_Q})\s+${PRICE_NUM}${NOT_KM}`, "g"), (m) => {
    const value = amount(m[2]!, m[3]);
    if (value === undefined) return false;
    if (!m[3] && !m[0].includes("r$") && value < 1_000) return false;
    if (isMaxQualifier(m[1])) result.priceMax = value;
    else result.priceMin = value;
    return true;
  });
  work.consume(new RegExp(String.raw`r\$\s*(${NUM})\s*(${MULT})?(?![a-z0-9])`, "g"), (m) =>
    setPriceMax(m[1]!, m[2]),
  );
  work.consume(
    new RegExp(String.raw`(?<![a-z0-9$.,])(${NUM})\s*(${MULT})(?![a-z0-9])${NOT_KM}`, "g"),
    (m) => setPriceMax(m[1]!, m[2]),
  );
  work.consume(
    new RegExp(
      String.raw`(?<![a-z0-9$.,])(\d{5,7}|\d{1,3}(?:\.\d{3}){1,2})(?![a-z0-9.,])${NOT_KM}`,
      "g",
    ),
    (m) => setPriceMax(m[1]!, undefined, 5_000),
  );
  work.consume(/r\$/g, () => true);

  function setPriceMax(raw: string, mult: string | undefined, min = 0): boolean {
    const value = amount(raw, mult);
    if (value === undefined || value < min) return false;
    result.priceMax = value;
    return true;
  }

  // --- tokens + dictionary -------------------------------------------------
  const tokens: Array<{ norm: string; key: string; orig: string }> = [];
  for (const m of work.text.matchAll(/[a-z0-9]+(?:[-'][a-z0-9]+)*/g)) {
    const start = m.index ?? 0;
    tokens.push({
      norm: m[0],
      key: aliasKey(m[0]),
      orig: original.slice(start, start + m[0].length),
    });
  }

  const allowAmbiguousUf = (i: number) => {
    const orig = tokens[i]!.orig;
    const prev = tokens[i - 1]?.norm;
    return (
      (orig === orig.toUpperCase() && /[A-Z]/.test(orig)) ||
      prev === "em" ||
      prev === "no" ||
      prev === "na" ||
      prev === "estado"
    );
  };

  const resolve = (entries: Entry[], index: number, length: number): Entry[] | null => {
    let usable = entries.filter(
      (e) => !(e.kind === "uf" && e.ambiguous && (length > 1 || !allowAmbiguousUf(index))),
    );
    const meaningful = usable.filter((e) => e.kind !== "stop");
    if (meaningful.length > 0) usable = meaningful;
    return usable.length > 0 ? usable : null;
  };

  type Plan = { covered: number; matches: number; picks: Entry[][]; leftovers: number[] };
  const best: Plan[] = new Array(tokens.length + 1);
  best[tokens.length] = { covered: 0, matches: 0, picks: [], leftovers: [] };
  for (let i = tokens.length - 1; i >= 0; i--) {
    const skip = best[i + 1]!;
    let choice: Plan = { ...skip, leftovers: [i, ...skip.leftovers] };
    const consider = (len: number, picks: Entry[][], cost: number) => {
      const rest = best[i + len]!;
      const candidate: Plan = {
        covered: rest.covered + len,
        matches: rest.matches + cost,
        picks: [...picks, ...rest.picks],
        leftovers: rest.leftovers,
      };
      if (
        candidate.covered > choice.covered ||
        (candidate.covered === choice.covered && candidate.matches < choice.matches)
      ) {
        choice = candidate;
      }
    };
    for (let len = 1; len <= Math.min(MAX_NGRAM, tokens.length - i); len++) {
      const key = tokens
        .slice(i, i + len)
        .map((t) => t.key)
        .join("");
      const entries = DICT.get(key);
      const resolved = entries ? resolve(entries, i, len) : null;
      if (resolved) consider(len, [resolved], 1);
      else if (len === 1) {
        const pieces = segment(key);
        if (pieces) consider(1, pieces, pieces.length);
      }
    }
    best[i] = choice;
  }

  const plan = best[0]!;
  let cityHint = false;
  let capitalHint = false;
  let homonym: { city: string; uf: Uf } | undefined;
  const ambiguousTrimGroups: string[][] = [];

  for (const group of plan.picks) {
    const trims = group.filter((e): e is Extract<Entry, { kind: "trim" }> => e.kind === "trim");
    if (trims.length > 1) ambiguousTrimGroups.push(trims.map((t) => t.id));
    for (const e of group) {
      switch (e.kind) {
        case "model":
          pushUnique(result.modelIds, e.id);
          break;
        case "engine":
          pushUnique(result.engineIds, e.id);
          break;
        case "trim":
          if (trims.length === 1) pushUnique(result.trimIds, e.id);
          break;
        case "fuel":
          for (const f of e.fuels) pushUnique(result.fuels, f);
          break;
        case "transmission":
          result.transmission = e.value;
          break;
        case "seller":
          result.sellerType = e.value;
          break;
        case "uf":
          result.uf = e.uf;
          break;
        case "city":
          result.city = e.city;
          result.uf = e.uf;
          break;
        case "homonym":
          homonym = { city: e.city, uf: e.uf };
          break;
        case "cityHint":
          cityHint = true;
          break;
        case "capitalHint":
          capitalHint = true;
          break;
        case "stop":
          break;
      }
    }
  }

  // --- post-processing -----------------------------------------------------
  const yearWindow = { min: result.yearMin, max: result.yearMax };

  for (const id of [...result.modelIds]) {
    const model = getModel(id);
    for (const variant of variantsOf(id)) pushUnique(result.modelIds, variant.id);
    for (const renamed of MODELS.filter((m) => m.renamedFrom?.modelId === id)) {
      if (renamed.renamedFrom!.scope === "all" || result.fuels.includes("eletrico")) {
        pushUnique(result.modelIds, renamed.id);
      }
    }
    if (model?.renamedFrom) {
      pushUnique(result.modelIds, model.renamedFrom.modelId);
      if (model.renamedFrom.scope === "electric" && result.fuels.length === 0) {
        result.fuels.push("eletrico");
      }
    }
  }

  // An alias like "polestar" maps to several trims: keep the ones that fit the
  // models/engines/years in the query (XC60 T8 → Polestar Engineered), and
  // prefer those sold in Brazil (the 2014–2018 Polestar series was not).
  for (const fullGroup of ambiguousTrimGroups) {
    const inBrazil = fullGroup.filter((id) => getTrim(id)?.brazil !== false);
    const group = inBrazil.length > 0 ? inBrazil : fullGroup;
    const fits = group.filter((trimId) => {
      const trim = TRIMS.find((t) => t.id === trimId);
      if (!trim) return false;
      if (
        trim.engineIds &&
        result.engineIds.length > 0 &&
        !result.engineIds.some((e) => trim.engineIds!.includes(e))
      ) {
        return false;
      }
      return (
        result.modelIds.length === 0 ||
        result.modelIds.some((m) => isTrimCompatible(trimId, m, yearWindow, result.engineIds))
      );
    });
    for (const id of fits.length > 0 ? fits : group) pushUnique(result.trimIds, id);
  }

  // A base trim also brings its variants (Ultimate → Ultimate Dark) when they fit the models.
  for (const id of [...result.trimIds]) {
    for (const variant of trimVariantsOf(id)) {
      if (
        result.modelIds.length === 0 ||
        result.modelIds.some((m) => isTrimCompatible(variant.id, m, yearWindow))
      ) {
        pushUnique(result.trimIds, variant.id);
      }
    }
  }

  for (const engineId of result.engineIds) {
    if (
      result.modelIds.length > 0 &&
      !result.modelIds.some((m) => isEngineCompatible(engineId, m, yearWindow))
    ) {
      const engine = ENGINES.find((e) => e.id === engineId);
      const names = result.modelIds.map((m) => getModel(m)?.name ?? m).join("/");
      result.warnings.push(`Não conhecemos ${names} com motor ${engine?.name ?? engineId}.`);
    }
  }

  // Market notes: things never sold officially in Brazil stay searchable, with a heads-up.
  const typedModels = result.modelIds.filter(
    (id) => !getModel(id)?.parentId || !result.modelIds.includes(getModel(id)!.parentId!),
  );
  for (const id of typedModels) {
    const model = getModel(id);
    if (model?.brazil === false) {
      result.warnings.push(`O ${model.name} não foi vendido oficialmente no Brasil.`);
    }
  }
  for (const engineId of result.engineIds) {
    const engine = getEngine(engineId);
    if (!engine) continue;
    if (engine.brazil === false) {
      result.warnings.push(`O motor ${engine.name} não foi vendido oficialmente no Brasil.`);
    } else if (
      Array.isArray(engine.brazil) &&
      result.modelIds.length > 0 &&
      !result.modelIds.some((m) => isEngineOfferedInBrazil(engineId, m, yearWindow))
    ) {
      result.warnings.push(
        `No Brasil, o ${engine.name} foi oferecido em: ${describeBrazilOffers(engine.brazil)}.`,
      );
    }
  }
  for (const trimId of result.trimIds) {
    const trim = getTrim(trimId);
    if (trim?.brazil === false) {
      result.warnings.push(`A versão ${trim.name} não foi vendida oficialmente no Brasil.`);
    }
  }

  if (homonym) {
    if (cityHint || capitalHint) {
      result.city = homonym.city;
      result.uf = homonym.uf;
    } else if (!result.city) {
      result.uf = homonym.uf;
      result.citySuggestion = homonym;
    }
  } else if (capitalHint && result.uf && !result.city) {
    result.city = CAPITALS.get(result.uf);
  }

  if (
    result.yearMin !== undefined &&
    result.yearMax !== undefined &&
    result.yearMin > result.yearMax
  ) {
    [result.yearMin, result.yearMax] = [result.yearMax, result.yearMin];
  }
  if (
    result.priceMin !== undefined &&
    result.priceMax !== undefined &&
    result.priceMin > result.priceMax
  ) {
    [result.priceMin, result.priceMax] = [result.priceMax, result.priceMin];
  }

  result.text = plan.leftovers.map((i) => tokens[i]!.norm).join(" ");
  return result;
}

function pushUnique<T>(list: T[], value: T) {
  if (!list.includes(value)) list.push(value);
}

// ---------------------------------------------------------------------------
// Segmentation of glued tokens ("s60t5", "xc60t8") into taxonomy aliases
// ---------------------------------------------------------------------------

const segmentCache = new Map<string, Entry[][] | null>();

function segment(key: string): Entry[][] | null {
  if (segmentCache.has(key)) return segmentCache.get(key)!;
  const memo = new Map<number, Entry[][] | null>();
  const solve = (pos: number): Entry[][] | null => {
    if (pos === key.length) return [];
    if (memo.has(pos)) return memo.get(pos)!;
    let bestPieces: Entry[][] | null = null;
    for (let end = key.length; end > pos; end--) {
      const piece = key.slice(pos, end);
      if (piece.length < 2 && piece !== "r") continue;
      const entries = DICT.get(piece)?.filter((e) => TAXONOMY_KINDS.has(e.kind));
      if (!entries || entries.length === 0) continue;
      const rest = solve(end);
      if (rest && (!bestPieces || rest.length + 1 < bestPieces.length)) {
        bestPieces = [entries, ...rest];
      }
    }
    memo.set(pos, bestPieces);
    return bestPieces;
  };
  const pieces = solve(0);
  const valid =
    pieces &&
    pieces.length >= 2 &&
    pieces.some((p) => p.some((e) => e.kind === "model" || e.kind === "engine"))
      ? pieces
      : null;
  segmentCache.set(key, valid);
  return valid;
}
