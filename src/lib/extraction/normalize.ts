/**
 * Deterministic post-AI normalization: turns the model's answer into database
 * fields, re-parses numbers from the original snippets, matches the taxonomy
 * and checks coherence. Every problem found lowers the confidence.
 */
import { parseBrazilianNumber, parseQuery } from "@/lib/search/parse-query";
import { isUf, type Uf } from "@/lib/search/places";
import {
  type Fuel,
  generationsFor,
  getEngine,
  getModel,
  getTrim,
  impliedFuel,
  isEngineCompatible,
  isEngineOfferedInBrazil,
  isTrimCompatible,
  MODELS,
  type Transmission,
} from "@/lib/taxonomy";

import { RED_FLAGS, type Extraction, type RedFlag } from "./schema";
import { foldText, sharesWordRun, trigramSimilarity } from "./text";

// ---------------------------------------------------------------------------
// Phones
// ---------------------------------------------------------------------------

export const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Brazilian phone → E.164 ("+5541990000001"), or null if it is not a valid BR number. */
export function normalizePhoneBR(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) return null;
  const local = digits.slice(2);
  if (local.length === 9) return local.startsWith("9") ? `+55${digits}` : null;
  // 8 digits: landline (2-5) or an old-format mobile (6-9) missing the leading 9.
  if (/^[2-5]/.test(local)) return `+55${digits}`;
  if (/^[6-9]/.test(local)) return `+55${digits.slice(0, 2)}9${local}`;
  return null;
}

const PHONE_CANDIDATE =
  /(?:\+?\s?55[\s.-]?)?\(?0?[1-9][1-9]\)?[\s.-]?9?[\s.]?\d{4}[\s.-]?\d{4}(?!\d)/g;

export function extractPhones(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(PHONE_CANDIDATE)) {
    const phone = normalizePhoneBR(m[0]);
    if (phone && !found.includes(phone)) found.push(phone);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

// The multiplier must end the word, so the "k" of "km" is not read as "mil".
const AMOUNT =
  /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(?:(milhoes|milhao|mil|mi|k)(?![a-z]))?/;
const MULT: Record<string, number> = { mil: 1e3, k: 1e3, mi: 1e6, milhao: 1e6, milhoes: 1e6 };

function amountFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = foldText(text).match(AMOUNT);
  if (!m) return null;
  const n = parseBrazilianNumber(m[1]!);
  if (n === undefined) return null;
  return Math.round(n * (m[2] ? MULT[m[2]]! : 1));
}

const FOREIGN_CURRENCY =
  /€|£|\beur(o|os)?\b|\busd\b|u\$s|us\$|\bkz\b|\bakz\b|kwanza|\bdolares\b|\bdollars?\b/;

/** Folded text quoting a price in another currency and never in reais. */
export function isForeignCurrency(folded: string): boolean {
  if (/r\$|\breais\b/.test(folded)) return false;
  return FOREIGN_CURRENCY.test(folded) || /\$\s?\d/.test(folded);
}

export const PRICE_RANGE = { min: 3_000, max: 15_000_000 };
export const KM_RANGE = { min: 0, max: 999_999 };

/** Price in reais from the snippet as written ("189k", "R$ 189.900,00"), else the model's number. */
export function normalizePrice(text: string | null, value: number | null): number | null {
  const fromText = amountFromText(text);
  const inRange = (n: number | null | undefined): n is number =>
    n != null && n >= PRICE_RANGE.min && n <= PRICE_RANGE.max;
  if (inRange(fromText)) return fromText;
  if (inRange(value)) return Math.round(value);
  // "189" with "mil"/"k" nearby but parsed without the multiplier.
  if (value != null && value > 0 && value < 3_000 && /mil|k\b/.test(foldText(text ?? ""))) {
    return inRange(value * 1000) ? Math.round(value * 1000) : null;
  }
  return null;
}

/** Mileage from the snippet as written ("58mil km", "58.000 km"), else the model's number. */
export function normalizeKm(text: string | null, value: number | null): number | null {
  const folded = foldText(text ?? "");
  if (/\b(0|zero)\s*km\b/.test(folded) && !/\d{2,}/.test(folded.replace(/\b0\s*km\b/, "")))
    return 0;
  const fromText = amountFromText(text);
  const inRange = (n: number | null | undefined): n is number =>
    n != null && n >= KM_RANGE.min && n <= KM_RANGE.max;
  if (inRange(fromText) && fromText > 0) return fromText;
  if (inRange(value)) return Math.round(value);
  return null;
}

/** Fab/model years: 2-digit years expanded, model year within [fab, fab + 1]. */
/**
 * The single fab/model year pair written in the caption, if any: "19/20",
 * "2019/2020" or "2024/24", with model = fab or fab + 1. Dates such as
 * "04/2023" or "12/2027" do not fit the shapes; two different pairs → null.
 */
export function yearPairFromCaption(
  caption: string,
  now: Date,
): { fab: number; model: number } | null {
  const max = now.getFullYear() + 1;
  const full = (y: string) => {
    const n = Number(y);
    return y.length === 4 ? n : n <= max % 100 ? 2000 + n : 1900 + n;
  };
  const found = new Map<string, { fab: number; model: number }>();
  for (const m of caption.matchAll(
    /(?<![\d/]|\d[.,])(\d{4}|\d{2})\s?\/\s?(\d{4}|\d{2})(?![\d/]|[.,]\d)/g,
  )) {
    const [a, b] = [m[1]!, m[2]!];
    if (a.length === 2 && b.length === 4) continue; // "04/2023" is a month
    const fab = full(a);
    const model = full(b);
    if (fab < 1970 || model > max || (model !== fab && model !== fab + 1)) continue;
    found.set(`${fab}/${model}`, { fab, model });
  }
  return found.size === 1 ? [...found.values()][0]! : null;
}

export function normalizeYears(
  fab: number | null,
  model: number | null,
  now: Date,
): { yearFab: number | null; yearModel: number | null; ok: boolean } {
  const max = now.getFullYear() + 1;
  const expand = (y: number | null) =>
    y == null ? null : y < 100 ? (y <= max % 100 ? 2000 + y : 1900 + y) : y;
  let f = expand(fab);
  let m = expand(model);
  const valid = (y: number | null) => y == null || (y >= 1970 && y <= max);
  if (!valid(f) || !valid(m)) return { yearFab: null, yearModel: null, ok: false };
  if (f != null && m == null) m = f;
  if (f != null && m != null && (m < f || m > f + 1)) {
    if (f === m + 1)
      [f, m] = [m, f]; // "20/19" written backwards
    else return { yearFab: null, yearModel: m, ok: false };
  }
  return { yearFab: f, yearModel: m, ok: true };
}

// ---------------------------------------------------------------------------
// Taxonomy matching
// ---------------------------------------------------------------------------

/** "XC6O" / "S6O": the letter O typed instead of zero next to digits. */
const fixLetterO = (text: string) => foldText(text).replace(/(?<=\d)o|o(?=\d)/g, "0");

function matchModel(raw: string | null): string | null {
  if (!raw) return null;
  const text = fixLetterO(raw);
  const parsed = parseQuery(text, { expand: false }).modelIds;
  if (parsed.length > 0) return parsed[parsed.length - 1]!; // most specific wins ("V40 Cross Country")
  // Typos: closest model name by trigram similarity.
  let best: { id: string; score: number } | null = null;
  for (const m of MODELS) {
    const score = trigramSimilarity(text.replace(/\bvolvo\b/g, ""), m.name);
    if (!best || score > best.score) best = { id: m.id, score };
  }
  return best && best.score >= 0.5 ? best.id : null;
}

function matchEngine(...texts: Array<string | null>): string | null {
  for (const text of texts) {
    if (!text) continue;
    const ids = parseQuery(text, { expand: false }).engineIds;
    if (ids.length > 0) return ids[0]!;
  }
  return null;
}

/** Engines the caption itself names (codes, names and aliases such as P8). */
function writtenEngines(caption: string): string[] {
  return parseQuery(fixLetterO(caption.slice(0, 4000)), { expand: false }).engineIds;
}

function matchTrim(
  modelId: string | null,
  engineId: string | null,
  ...texts: Array<string | null>
) {
  for (const text of texts) {
    if (!text) continue;
    const ids = parseQuery([modelId ? getModel(modelId)?.name : "", text].join(" "), {
      expand: false,
    }).trimIds;
    const fitting = ids.filter(
      (id) => !modelId || isTrimCompatible(id, modelId, {}, engineId ? [engineId] : []),
    );
    const pick = fitting[fitting.length - 1] ?? ids[ids.length - 1];
    if (pick) return pick;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Colors and summary checks
// ---------------------------------------------------------------------------

/** Feminine/plural forms of car colors → the masculine singular used on the page. */
const COLOR_WORDS: Record<string, string> = {
  preta: "preto",
  pretos: "preto",
  branca: "branco",
  brancos: "branco",
  vermelha: "vermelho",
  amarela: "amarelo",
  dourada: "dourado",
  prateada: "prateado",
  roxa: "roxo",
  metalica: "metálico",
  metálica: "metálico",
  perolizada: "perolizado",
  fosca: "fosco",
  escura: "escuro",
  clara: "claro",
};

/** "Vermelha metálica" → "vermelho metálico"; unknown words are kept. */
export function normalizeColor(raw: string | null): string | null {
  const text = raw?.trim().toLowerCase();
  if (!text) return null;
  return text
    .split(/\s+/)
    .map((w) => COLOR_WORDS[w] ?? w)
    .join(" ");
}

const CONTACT_WORDS =
  /\b(contato|contatar|whats(app)?|zap|wpp|direct|inbox|dm|telefone|ligar|ligue|chame|chamar)\b/;
const CONTACT_DATA = /@[a-z0-9._]{2,}|https?:\/\/|www\./;
const SUMMARY_PRICE = /r\$|\breais\b|\b\d+([.,]\d+)?\s*(mil|k)\b(?!\s*(km|quilometr|rodad))/;

/**
 * Drops sentences that only say how to reach the seller ("Contato pelo
 * direct."): the page has its own contact button. Keeps the text if nothing
 * else would remain.
 */
export function stripContactSentences(summary: string): string {
  const sentences = summary.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !CONTACT_WORDS.test(foldText(s)));
  return kept.length > 0 && kept.length < sentences.length ? kept.join(" ") : summary;
}

/**
 * The summary is public (page, meta description) while the phone is not, so a
 * phone, @handle or link in it goes to moderation; a price there gets stale.
 */
function checkSummary(
  summary: string,
  issue: (code: string, message: string, penalty: number) => void,
) {
  const folded = foldText(summary);
  if (extractPhones(summary).length > 0 || CONTACT_DATA.test(folded)) {
    issue("summary_contact", "O resumo traz dado de contato (telefone, @ ou link).", 0.3);
  }
  if (SUMMARY_PRICE.test(folded)) {
    issue("summary_price", "O resumo menciona o preço.", 0.1);
  }
}

// ---------------------------------------------------------------------------
// Red flags found by rule (in addition to the model's)
// ---------------------------------------------------------------------------

/**
 * Repasse and ágio are shown to buyers, so they need the caption's own words:
 * the model's flag alone is not enough, and "não é repasse" does not count.
 */
const REPASSE = /\b(repasse|repasses|repasso|repassando|repassar|repassamos)\b/;
const AGIO =
  /\bagio\b|\bassum(ir|e|a|o) (as |a |suas )?(parcelas|prestacoes|financiamento)\b|\b(transfiro|passo|repasso) (o )?financiamento\b/;
const NEGATED =
  /\b(nao (e|eh|sou|faco|fazemos|trabalho com|trabalhamos com|aceito)|nada de|sem|nunca)\s+(\w+\s+){0,2}?(repass\w*|agio)\b/g;

/** Whether the caption itself (negations removed) calls the sale a repasse / an ágio. */
export function writtenSaleType(folded: string): { repasse: boolean; agio: boolean } {
  const text = folded.replace(NEGATED, " ");
  return { repasse: REPASSE.test(text), agio: AGIO.test(text) };
}

const RED_FLAG_RULES: Array<[RedFlag, RegExp]> = [
  [
    "pedido_de_sinal",
    /\b(sinal|reserva)\b.{0,40}\b(pix|deposit|transfer|antecipad)|\b(pix|deposit)\w*.{0,40}\b(sinal|reserva)\b/,
  ],
  ["leilao", /\bleila?o\b|\bleiloes\b|\bde leilao\b/],
  ["sinistro", /\b(sinistro|sinistrado|recuperado de|indenizado|perda total)\b/],
  [
    "documento_pendente",
    /\b(ipva|licenciamento|documento|documentacao|debitos?|multas?)\b.{0,15}\b(atrasad|pendente|em aberto|vencid|a pagar)/,
  ],
  ["abaixo_do_mercado", /\babaixo da (tabela|fipe)\b|\bmuito abaixo\b|\bbem abaixo\b/],
];

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

export interface NormalizationIssue {
  code: string;
  message: string;
  penalty: number;
}

export interface NormalizedListing {
  isListing: boolean;
  modelId: string | null;
  engineId: string | null;
  trimId: string | null;
  versionText: string | null;
  yearFab: number | null;
  yearModel: number | null;
  km: number | null;
  priceCents: number | null;
  city: string | null;
  uf: Uf | null;
  color: string | null;
  transmission: Transmission | null;
  fuel: Fuel | null;
  options: string[];
  sellerType: "loja" | "particular" | "desconhecido";
  contactPhone: string | null;
  contactIgUsername: string | null;
  summary: string;
  redFlags: RedFlag[];
  /** Model's confidence after coherence penalties. */
  confidence: number;
  issues: NormalizationIssue[];
}

export interface NormalizeContext {
  caption: string;
  igUsername?: string | null;
  bio?: string | null;
  now?: Date;
}

export function normalizeExtraction(x: Extraction, ctx: NormalizeContext): NormalizedListing {
  const now = ctx.now ?? new Date();
  const issues: NormalizationIssue[] = [];
  const issue = (code: string, message: string, penalty: number) =>
    issues.push({ code, message, penalty });

  // Taxonomy
  const modelId = matchModel(x.model) ?? matchModel(x.version_text);
  // The version as written beats the model's engine field: "P6 Recharge" with
  // engine "Twin Motor" is a Single Motor. And an engine the caption never
  // names is a guess (from power, battery or trim): drop it.
  const guessedEngine = matchEngine(x.version_text, x.engine);
  const engineId =
    guessedEngine && writtenEngines(ctx.caption).includes(guessedEngine) ? guessedEngine : null;
  const trimId = matchTrim(modelId, engineId, x.trim, x.version_text);

  // Numbers
  // Like price and km, a fab/model pair written in the caption ("20/20",
  // "2019/2020", "2024/24") beats the model's reading of it.
  const written = yearPairFromCaption(ctx.caption, now);
  const years = written
    ? normalizeYears(written.fab, written.model, now)
    : normalizeYears(x.year_fab, x.year_model, now);
  if (!years.ok) issue("year_invalid", "Ano de fabricação/modelo incoerente.", 0.15);
  // A price in another currency is not a price in reais: drop it and send the
  // post to moderation (it is most likely not a Brazilian listing).
  const foreignCurrency =
    isForeignCurrency(foldText(x.price_text ?? "")) || isForeignCurrency(foldText(ctx.caption));
  if (foreignCurrency) {
    issue(
      "foreign_currency",
      "Preço em moeda estrangeira: o anúncio provavelmente não é do Brasil.",
      0.3,
    );
  }
  const price = foreignCurrency ? null : normalizePrice(x.price_text, x.price);
  // "Consulte valor" (price on request) is no price, not an invalid one.
  const statedPrice = (x.price != null && x.price > 0) || /\d/.test(foldText(x.price_text ?? ""));
  if (statedPrice && price == null && !foreignCurrency) {
    issue("price_invalid", "Preço fora da faixa plausível.", 0.1);
  }
  const km = normalizeKm(x.km_text, x.km);

  // Place
  let uf: Uf | null = x.uf && isUf(x.uf.trim()) ? (x.uf.trim().toUpperCase() as Uf) : null;
  let city: string | null = x.city?.trim() || null;
  if (city) {
    const place = parseQuery(city, { expand: false });
    // The search reads a bare "São Paulo"/"Rio de Janeiro" as the state; in the
    // city field it means the city.
    const found = place.city ? { city: place.city, uf: place.uf } : place.citySuggestion;
    if (found) {
      if (uf && found.uf && uf !== found.uf) {
        issue("place_mismatch", `Cidade ${found.city} não fica em ${uf}.`, 0.05);
      }
      city = found.city;
      uf ??= found.uf ?? null;
    } else if (place.uf) {
      // A state in the city field ("RJ", "Paraná") or an unknown city plus its state ("Toledo PR").
      uf ??= place.uf;
      if (!place.text) city = null;
    }
  }

  // Fuel from engine when unambiguous; flag conflicts.
  let fuel: Fuel | null = x.fuel;
  if (engineId) {
    const implied = impliedFuel(engineId);
    const engine = getEngine(engineId)!;
    if (fuel && !engine.fuels.includes(fuel)) {
      issue("fuel_mismatch", `Combustível não bate com o motor ${engine.name}.`, 0.1);
      fuel = implied ?? fuel;
    } else if (!fuel && implied) {
      fuel = implied;
    }
  }

  // Coherence with the taxonomy and the Brazilian market
  const yearWindow = years.yearModel ? { min: years.yearModel, max: years.yearModel } : {};
  if (x.is_vehicle_for_sale && !modelId) issue("model_unknown", "Modelo não reconhecido.", 0.3);
  if (modelId) {
    const model = getModel(modelId)!;
    if (years.yearModel && generationsFor(modelId, yearWindow).length === 0) {
      issue("year_model_mismatch", `${model.name} não existe no ano ${years.yearModel}.`, 0.2);
    }
    if (model.brazil === false) {
      issue("model_not_in_brazil", `${model.name} não foi vendido oficialmente no Brasil.`, 0.2);
    }
    if (engineId) {
      const engine = getEngine(engineId)!;
      if (!isEngineCompatible(engineId, modelId, yearWindow)) {
        issue("engine_mismatch", `${model.name} ${engine.name} não existe nesse ano.`, 0.15);
      } else if (!isEngineOfferedInBrazil(engineId, modelId, yearWindow)) {
        issue(
          "engine_not_in_brazil",
          `${model.name} ${engine.name} não foi vendido no Brasil.`,
          0.2,
        );
      }
    }
    if (trimId) {
      const trim = getTrim(trimId)!;
      if (!isTrimCompatible(trimId, modelId, yearWindow, engineId ? [engineId] : [])) {
        issue("trim_mismatch", `Versão ${trim.name} não combina com ${model.name}.`, 0.1);
      } else if (trim.brazil === false) {
        issue("trim_not_in_brazil", `Versão ${trim.name} não foi vendida no Brasil.`, 0.15);
      }
    }
  }

  // Contact: phones the model saw + any in the caption; the profile bio is the fallback.
  // Order: numbers the model read that are in the caption, other caption
  // numbers, the model's remaining ones, and the profile bio last (fallback).
  const fromModel = x.phones.map(normalizePhoneBR).filter((p): p is string => p !== null);
  const inCaption = extractPhones(ctx.caption);
  const inBio = ctx.bio ? extractPhones(ctx.bio) : [];
  const phones = [
    ...fromModel.filter((p) => inCaption.includes(p)),
    ...inCaption,
    ...fromModel.filter((p) => !inBio.includes(p)),
    ...inBio,
  ];
  const contactPhone = phones[0] ?? null;
  const contactIgUsername = ctx.igUsername?.replace(/^@/, "").toLowerCase() || null;

  // Red flags: the model's + rule-based ones.
  const folded = foldText(ctx.caption);
  const redFlags = new Set<RedFlag>(x.red_flags.filter((f) => RED_FLAGS.includes(f)));
  for (const [flag, re] of RED_FLAG_RULES) if (re.test(folded)) redFlags.add(flag);
  const saleType = writtenSaleType(folded);
  for (const flag of ["repasse", "agio"] as const) {
    if (saleType[flag]) redFlags.add(flag);
    else redFlags.delete(flag);
  }
  if (!contactPhone && !contactIgUsername) redFlags.add("sem_contato");
  else redFlags.delete("sem_contato");
  // A repasse or ágio that asks for a deposit up front is a common scam pattern.
  if ((redFlags.has("repasse") || redFlags.has("agio")) && redFlags.has("pedido_de_sinal")) {
    issue(
      "repasse_com_sinal",
      "Repasse ou ágio com pedido de sinal: padrão comum de golpe, revisar antes de publicar.",
      0.5,
    );
  }

  // Compliance: the summary must be in our own words.
  const summary = stripContactSentences(x.summary_ptbr.trim());
  if (sharesWordRun(summary, ctx.caption, 8)) {
    issue("summary_copied", "O resumo repete trechos da legenda.", 0.3);
  }
  if (summary) checkSummary(summary, issue);

  const penalty = issues.reduce((sum, i) => sum + i.penalty, 0);
  const confidence = Math.max(0, Math.min(1, Math.min(x.confidence, 1) - penalty));

  return {
    isListing: x.is_vehicle_for_sale,
    modelId,
    engineId,
    trimId,
    versionText: x.version_text?.trim() || null,
    yearFab: years.yearFab,
    yearModel: years.yearModel,
    km,
    priceCents: price == null ? null : price * 100,
    city,
    uf,
    color: normalizeColor(x.color),
    transmission: x.transmission,
    fuel,
    options: [...new Set(x.options.map((o) => o.trim()).filter(Boolean))].slice(0, 12),
    sellerType: x.seller_type,
    contactPhone,
    contactIgUsername,
    summary,
    redFlags: [...redFlags],
    confidence: Math.round(confidence * 100) / 100,
    issues,
  };
}

/** Minimum fields to publish without moderation (PROMPT.md §7.5.6). */
export function hasMinimumFields(n: NormalizedListing): boolean {
  return (
    n.isListing &&
    n.modelId !== null &&
    n.yearModel !== null &&
    (n.priceCents !== null || n.contactPhone !== null || n.contactIgUsername !== null)
  );
}
