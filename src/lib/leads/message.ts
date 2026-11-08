/**
 * The pre-filled WhatsApp message: template rendering and placeholder checks.
 * No Node APIs, so the admin can preview the message in the browser.
 */

export const DEFAULT_MESSAGE_TEMPLATE =
  "Olá! Vi seu Volvo {modelo} {versao} {ano} anunciado no {site} ({url}). Ainda está disponível? (ref. {ref})";

export interface MessageVars {
  modelo: string;
  versao?: string | null;
  ano?: number | string | null;
  site: string;
  url: string;
  ref: string;
}

/** Spellings accepted in the template (the spec and the admin may use either). */
const ALIASES: Record<string, keyof MessageVars> = {
  modelo: "modelo",
  versao: "versao",
  versão: "versao",
  ano: "ano",
  site: "site",
  nome_do_site: "site",
  url: "url",
  url_curta: "url",
  link: "url",
  ref: "ref",
  codigo: "ref",
  código: "ref",
};

/** Placeholders a template uses that the message cannot fill (shown to the admin). */
export function unknownPlaceholders(template: string): string[] {
  return [...template.matchAll(/\{([^{}]+)\}/g)]
    .map((m) => m[1]!.trim())
    .filter((name) => !ALIASES[name.toLowerCase()]);
}

/**
 * Fills `{placeholders}` (case-insensitive). Missing values leave no gaps:
 * double spaces, spaces before punctuation and empty parentheses are removed.
 * Unknown placeholders stay as written so a broken template is noticed.
 */
export function renderMessage(template: string, vars: MessageVars): string {
  const filled = template.replace(/\{([^{}]+)\}/g, (whole, raw: string) => {
    const key = ALIASES[raw.trim().toLowerCase()];
    if (!key) return whole;
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value).trim();
  });
  return filled
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:!?)])/g, "$1")
    .replace(/\( +/g, "(")
    .trim();
}
