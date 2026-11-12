/**
 * Texts of the intermediated model: the invite sent to the seller and the
 * Buy My Volvo WhatsApp numbers that receive buyers. Pure, no Node APIs (the
 * admin forms use them in the browser too).
 */
import { normalizePhoneBR } from "@/lib/extraction/normalize";
import { renderMessage, unknownPlaceholders } from "@/lib/leads/message";

export const DEFAULT_INVITE_TEMPLATE =
  "Olá! Aqui é do {site}, um site que reúne anúncios de Volvo seminovos. Vimos o seu Volvo {modelo} {versao} {ano} e gostaríamos de divulgá-lo e levar compradores até você. Veja as condições e autorize por este link: {link}";

export interface InviteVars {
  modelo: string;
  versao?: string | null;
  ano?: number | null;
  site: string;
  link: string;
}

/** `{link}` (or `{url}`) is the invite page; same placeholder rules as the buyer's message. */
export const renderInvite = (template: string, vars: InviteVars) =>
  renderMessage(template, { ...vars, url: vars.link, ref: "" });

/** Problem with an invite template, or null. */
export function inviteTemplateProblem(template: string): string | null {
  const unknown = unknownPlaceholders(template).filter((p) => !/^(ref|codigo|código)$/i.test(p));
  if (!template) return "A mensagem não pode ficar vazia.";
  if (template.length > 700) return "Use no máximo 700 caracteres.";
  if (!/\{(link|url|url_curta)\}/i.test(template))
    return "Inclua {link}: é o endereço da autorização.";
  if (unknown.length) return `Variável desconhecida: {${unknown[0]}}.`;
  if (/\{(ref|codigo|código)\}/i.test(template))
    return "O convite não tem código de contato: tire {ref}.";
  return null;
}

export const MAX_BMV_NUMBERS = 4;

const splitNumbers = (raw: string) =>
  raw
    .split(/[,;\n]|\s+e\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * The Buy My Volvo WhatsApp numbers typed in Configurações ("(11) 9...,
 * (11) 9..."): one number (shared by both partners with linked devices) or
 * several (leads alternate between them). Only valid Brazilian numbers.
 */
export function parseBmvNumbers(raw: string): { numbers: string[]; invalid: string[] } {
  const numbers: string[] = [];
  const invalid: string[] = [];
  for (const part of splitNumbers(raw)) {
    const phone = normalizePhoneBR(part);
    if (!phone) invalid.push(part);
    else if (!numbers.includes(phone)) numbers.push(phone);
  }
  return { numbers, invalid };
}

/** The saved setting ("+55..., +55..."), as E.164 numbers (the seed's DDD 20 included). */
export const readBmvNumbers = (saved: unknown): string[] =>
  typeof saved === "string"
    ? splitNumbers(saved)
        .filter((p) => /^\+[1-9]\d{9,14}$/.test(p))
        .slice(0, MAX_BMV_NUMBERS)
    : [];

/** The number after the one that got the latest lead (round-robin); the first otherwise. */
export function nextBmvNumber(numbers: string[], lastUsed: string | null): string | null {
  if (numbers.length === 0) return null;
  const index = lastUsed ? numbers.indexOf(lastUsed) : -1;
  return numbers[(index + 1) % numbers.length]!;
}

/** "R$ 1.500" (whole reais), or null while the commission is not defined. */
export function formatCommission(cents: number | null): string | null {
  if (!cents || cents <= 0) return null;
  const reais = cents / 100;
  return reais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(reais) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
