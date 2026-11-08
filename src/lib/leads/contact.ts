/**
 * Pure helpers for the contact click: lead reference codes, the pre-filled
 * WhatsApp message and the destination links. No I/O, no env.
 */
import { randomInt } from "node:crypto";

/** Readable alphabet: no 0/O, 1/I/L, so a seller can read the code back over the phone. */
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const REF_PREFIX = "VX";
/** Same shape as the `leads.ref_code` check constraint. */
export const REF_CODE_PATTERN = /^[A-Z]{2}-[0-9A-Z]{4,8}$/;

export function generateRefCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) code += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `${REF_PREFIX}-${code}`;
}

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

/** `https://wa.me/<digits>?text=<message>` (wa.me wants the number without "+"). */
export function whatsappUrl(phoneE164: string, text: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(digits)) throw new Error(`Invalid phone for WhatsApp: ${phoneE164}`);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const IG_USERNAME = /^[a-z0-9._]{1,30}$/i;
const IG_PERMALINK = /^https:\/\/(www\.)?instagram\.com\/[\w./-]+$/;

/**
 * Instagram fallback when the post has no phone: the Direct conversation
 * (`ig.me/m/<user>`) when the seller's @ is known, otherwise the post itself.
 */
export function instagramUrl(target: {
  username?: string | null;
  permalink?: string | null;
}): string | null {
  const username = target.username?.replace(/^@/, "").trim();
  if (username && IG_USERNAME.test(username)) return `https://ig.me/m/${username}`;
  if (target.permalink && IG_PERMALINK.test(target.permalink)) return target.permalink;
  return null;
}

/** Demo listings use DDD 20, which does not exist: their click shows a preview instead. */
export const isFictitiousPhone = (phoneE164: string | null): boolean =>
  !!phoneE164?.startsWith("+5520");
