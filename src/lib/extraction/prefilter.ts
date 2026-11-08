/**
 * Cheap regex pre-filter (no AI). A post goes to extraction only if it
 * (1) is about a Volvo, (2) has sale signals and (3) has Brazil signals.
 * Hashtag searches return posts from the whole world, hence (3).
 */
import { parseQuery } from "@/lib/search/parse-query";

/**
 * Where the post came from. Shops on our curated Business Discovery list are
 * Brazilian, so their posts skip the Brazil check; hashtag posts come from
 * the whole world and need a strong Brazil signal (R$, +55 or a DDD phone).
 * Without an origin (tests, evals) the original, weaker rules apply.
 */
export type PrefilterOrigin = "business_discovery" | "hashtag";

export interface PrefilterResult {
  pass: boolean;
  reason: "ok" | "not_volvo" | "no_sale_signal" | "not_brazil" | "wanted_ad" | "sold";
  signals: { volvo: string[]; sale: string[]; brazil: string[] };
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const SALE_PATTERNS: Array<[string, RegExp]> = [
  ["R$", /r\$\s*\d/],
  ["vendo/vende", /\bvend(o|e|emos)\b/],
  ["à venda", /\ba venda\b|\bpra vender\b|\bpara venda\b/],
  ["km", /\d[\d.\s]*(mil\s*)?km\b|\bkm\s*\d/],
  ["troca", /\b(aceito|aceita|estudo|avalio)\s+troca\b/],
  ["financiamento", /\bfinanci(o|amos|amento|a)\b/],
  ["repasse", /\brepasse\b/],
  ["valor/preço", /\b(valor|preco)\b/],
  ["particular/loja", /\b(particular|unico dono|loja|concessionaria|revenda)\b/],
  ["contato", /\b(whats|whatsapp|zap|wpp|chama no direct|inbox|dm)\b/],
  ["fipe", /\bfipe\b/],
];

const BRAZIL_PATTERNS: Array<[string, RegExp]> = [
  ["R$", /r\$/],
  ["+55", /\+\s?55\b/],
  ["DDD/telefone", /\(?\b[1-9][1-9]\)?\s?9?\d{4}[-\s.]?\d{4}\b/],
  [
    "português",
    /\b(vendo|troca|quilometragem|cambio|revisoes|unico dono|ipva|licenciado|baixa km|zerado|financio|particular)\b/,
  ],
];
/** State codes only in uppercase: "es", "pe", "ms" are common Spanish/Italian/Portuguese words. */
const UF_UPPER = /\b(SP|RJ|MG|PR|SC|RS|DF|GO|BA|PE|CE|ES|MT|MS)\b/;
const STRONG_BRAZIL = new Set(["R$", "+55", "DDD/telefone"]);

// Other markets: currencies and words a Brazilian ad would not use.
const FOREIGN =
  /\b(for sale|se vende|u\$s|usd|eur|€|£|miles\b|kms?\s+only|price:|kz|akz|kwanza|viatura|gasoil)/;
const WANTED = /\b(procuro|procura-se|compro|quero comprar|alguem vendendo|alguem vende)\b/;
const SOLD = /\b(vendido|vendida)\b/;
const NUMERIC_MODELS = new Set(["240", "740", "760", "850", "940", "960"]);

export function prefilter(
  caption: string | null | undefined,
  options: { origin?: PrefilterOrigin } = {},
): PrefilterResult {
  const text = fold(caption ?? "");
  const signals = { volvo: [] as string[], sale: [] as string[], brazil: [] as string[] };

  const mentionsVolvo = /\bvolvo\b/.test(text);
  if (mentionsVolvo) signals.volvo.push("volvo");
  // Model names via the search parser; numeric names (850, 940…) only count next to "volvo".
  const models = parseQuery(text.slice(0, 300), { expand: false }).modelIds.filter(
    (id) => mentionsVolvo || !NUMERIC_MODELS.has(id),
  );
  signals.volvo.push(...models);

  for (const [name, re] of SALE_PATTERNS) if (re.test(text)) signals.sale.push(name);
  for (const [name, re] of BRAZIL_PATTERNS) if (re.test(text)) signals.brazil.push(name);
  if (UF_UPPER.test(caption ?? "")) signals.brazil.push("UF");

  const result = (reason: PrefilterResult["reason"]): PrefilterResult => ({
    pass: reason === "ok",
    reason,
    signals,
  });

  if (signals.volvo.length === 0) return result("not_volvo");
  if (WANTED.test(text) && !/\bvendo\b/.test(text)) return result("wanted_ad");
  if (SOLD.test(text) && !/\b(vendo|a venda)\b/.test(text)) return result("sold");
  if (signals.sale.length === 0) return result("no_sale_signal");
  if (options.origin !== "business_discovery") {
    const strong = signals.brazil.some((s) => STRONG_BRAZIL.has(s));
    if (
      signals.brazil.length === 0 ||
      (options.origin === "hashtag" && !strong) ||
      (FOREIGN.test(text) && !signals.brazil.includes("R$"))
    ) {
      return result("not_brazil");
    }
  }
  return result("ok");
}
