/**
 * Admin listing form → validated patch. Pure (no I/O): errors block the save,
 * warnings (taxonomy combinations that look wrong) only inform the moderator.
 */
import { normalizePhoneBR } from "@/lib/extraction/normalize";
import { RED_FLAGS, type RedFlag } from "@/lib/extraction/schema";
import { UFS } from "@/lib/search/places";
import {
  type Fuel,
  FUELS,
  getEngine,
  getModel,
  getTrim,
  isEngineCompatible,
  isSoldInBrazil,
  isTrimCompatible,
  SELLER_TYPES,
  type SellerType,
  type Transmission,
  TRANSMISSIONS,
} from "@/lib/taxonomy";

export interface ListingPatch {
  modelId: string;
  engineId: string | null;
  trimId: string | null;
  versionText: string | null;
  yearFab: number | null;
  yearModel: number | null;
  km: number | null;
  priceCents: number | null;
  city: string | null;
  uf: string | null;
  color: string | null;
  transmission: Transmission | null;
  fuel: Fuel | null;
  sellerType: SellerType;
  phone: string | null;
  igUsername: string | null;
  summary: string | null;
  redFlags: RedFlag[];
  options: string[];
}

/** Form field names (PT-BR, as in the page) → patch keys. */
export const FIELD_LABELS: Record<keyof ListingPatch, string> = {
  modelId: "Modelo",
  engineId: "Motor",
  trimId: "Versão",
  versionText: "Versão escrita",
  yearFab: "Ano de fabricação",
  yearModel: "Ano-modelo",
  km: "Km",
  priceCents: "Preço",
  city: "Cidade",
  uf: "UF",
  color: "Cor",
  transmission: "Câmbio",
  fuel: "Combustível",
  sellerType: "Vendedor",
  phone: "Telefone",
  igUsername: "Instagram",
  summary: "Resumo",
  redFlags: "Alertas",
  options: "Itens",
};

export type FormInput = Record<string, string | string[] | undefined>;

export type ParseResult =
  | { ok: true; patch: ListingPatch; warnings: string[] }
  | { ok: false; errors: Partial<Record<keyof ListingPatch, string>> };

export function formDataToInput(form: FormData): FormInput {
  const input: FormInput = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key).filter((v): v is string => typeof v === "string");
    input[key] = key === "alertas" ? values : values[0];
  }
  return input;
}

const text = (input: FormInput, key: string, max = 120): string | null => {
  const value = input[key];
  const s = (Array.isArray(value) ? value[0] : value)?.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
};

/** "295.000", "R$ 295.000,00", "295000" → 295000. Not a number → NaN. */
export function parseBRNumber(raw: string): number {
  let s = raw.replace(/r\$|\s/gi, "");
  const decimal = /,(\d{1,2})$/.exec(s);
  if (decimal) s = s.slice(0, decimal.index).replace(/\./g, "") + "." + decimal[1];
  else s = s.replace(/[.,]/g, "");
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function parseListingForm(
  input: FormInput,
  current: { phone: string | null } = { phone: null },
): ParseResult {
  const errors: Partial<Record<keyof ListingPatch, string>> = {};
  const warnings: string[] = [];

  const modelId = text(input, "modelo") ?? "";
  const model = getModel(modelId);
  if (!model) errors.modelId = "Escolha o modelo.";
  const engineId = text(input, "motor");
  if (engineId && !getEngine(engineId)) errors.engineId = "Motor desconhecido.";
  const trimId = text(input, "versao");
  if (trimId && !getTrim(trimId)) errors.trimId = "Versão desconhecida.";

  const year = (key: string, field: keyof ListingPatch) => {
    const raw = text(input, key);
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1970 || n > 2100) {
      errors[field] = "Ano inválido.";
      return null;
    }
    return n;
  };
  const yearFab = year("ano_fab", "yearFab");
  const yearModel = year("ano_modelo", "yearModel");
  if (yearFab && yearModel && (yearModel < yearFab || yearModel > yearFab + 1)) {
    errors.yearModel = "O ano-modelo é o ano de fabricação ou o seguinte.";
  }

  const amount = (key: string, field: keyof ListingPatch, label: string) => {
    const raw = text(input, key);
    if (!raw) return null;
    const n = parseBRNumber(raw);
    if (!Number.isFinite(n) || n < 0) {
      errors[field] = `${label} inválido.`;
      return null;
    }
    return n;
  };
  const km = amount("km", "km", "Km");
  const price = amount("preco", "priceCents", "Preço");
  if (price !== null && (price < 1000 || price > 20_000_000)) {
    errors.priceCents = "Preço fora da faixa plausível (R$ 1.000 a R$ 20 milhões).";
  }

  const uf = text(input, "uf")?.toUpperCase() ?? null;
  if (uf && !(uf in UFS)) errors.uf = "UF inválida.";

  const pick = <T extends string>(
    key: string,
    allowed: readonly T[],
    field: keyof ListingPatch,
  ) => {
    const value = text(input, key);
    if (!value) return null;
    if (!allowed.includes(value as T)) {
      errors[field] = "Opção inválida.";
      return null;
    }
    return value as T;
  };
  const transmission = pick("cambio", TRANSMISSIONS, "transmission");
  const fuel = pick("combustivel", FUELS, "fuel");
  const sellerType = pick("vendedor", SELLER_TYPES, "sellerType") ?? "desconhecido";

  // The stored phone stays as is (demo listings use a fictitious DDD); a new one must be valid.
  let phone: string | null = null;
  const rawPhone = text(input, "telefone");
  if (rawPhone) {
    const digits = rawPhone.replace(/\D/g, "");
    if (current.phone && digits === current.phone.replace(/\D/g, "")) phone = current.phone;
    else {
      phone = normalizePhoneBR(rawPhone);
      if (!phone) errors.phone = "Telefone brasileiro inválido (DDD + número).";
    }
  }

  const igUsername = text(input, "instagram")?.replace(/^@/, "").toLowerCase() ?? null;
  if (igUsername && !/^[a-z0-9._]{1,30}$/.test(igUsername)) errors.igUsername = "@ inválido.";

  const summary = text(input, "resumo", 2000);
  if (summary && summary.length > 600) errors.summary = "Resumo com mais de 600 caracteres.";

  const flags = input.alertas;
  const redFlags = (Array.isArray(flags) ? flags : flags ? [flags] : []).filter((f): f is RedFlag =>
    (RED_FLAGS as readonly string[]).includes(f),
  );
  const options = (text(input, "itens", 600) ?? "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const years = { min: yearFab ?? yearModel ?? undefined, max: yearModel ?? yearFab ?? undefined };
  if (model && model.brazil === false) warnings.push(`${model.name} não foi vendido no Brasil.`);
  if (engineId && !isEngineCompatible(engineId, modelId, years)) {
    warnings.push(`O motor ${getEngine(engineId)!.name} não combina com ${model!.name} nesse ano.`);
  } else if (engineId && !isSoldInBrazil("engine", engineId)) {
    warnings.push(`O motor ${getEngine(engineId)!.name} não foi vendido no Brasil.`);
  }
  if (trimId && !isTrimCompatible(trimId, modelId, years, engineId ? [engineId] : [])) {
    warnings.push(`A versão ${getTrim(trimId)!.name} não combina com ${model!.name}.`);
  }

  return {
    ok: true,
    warnings,
    patch: {
      modelId,
      engineId,
      trimId,
      versionText: text(input, "versao_texto", 80),
      yearFab,
      yearModel,
      km: km === null ? null : Math.round(km),
      priceCents: price === null ? null : Math.round(price * 100),
      city: text(input, "cidade", 80),
      uf,
      color: text(input, "cor", 40)?.toLowerCase() ?? null,
      transmission,
      fuel,
      sellerType,
      phone,
      igUsername,
      summary,
      redFlags,
      options,
    },
  };
}

/** Minimum to publish (mirrors the database rule for active listings). */
export const publishable = (
  p: Pick<ListingPatch, "yearModel" | "priceCents" | "phone" | "igUsername">,
) => p.yearModel !== null && (p.priceCents !== null || p.phone !== null || p.igUsername !== null);
