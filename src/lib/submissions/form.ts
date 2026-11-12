/**
 * The public form "Anuncie no Buy My Volvo" (Phase 9b): select options and
 * validation. Pure (taxonomy only), so the page can build the options on the
 * server and the tests run without a database.
 */
import { parseBRNumber } from "@/lib/admin/listing-form";
import { extractPhones, normalizePhoneBR } from "@/lib/extraction/normalize";
import { parseCnpj, parseCpf } from "@/lib/identity/document";
import { UFS } from "@/lib/search/places";
import {
  enginesForSelect,
  type Fuel,
  FUEL_LABELS,
  FUELS,
  getModel,
  impliedFuel,
  isEngineCompatible,
  isEngineOfferedInBrazil,
  isTrimCompatible,
  modelsForSelect,
  type Transmission,
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
  trimsForSelect,
} from "@/lib/taxonomy";

export interface Option {
  value: string;
  label: string;
}

export interface PublicFormOptions {
  models: Option[];
  /** Engines and trims offered in Brazil for each model. */
  enginesByModel: Record<string, Option[]>;
  trimsByModel: Record<string, Option[]>;
  ufs: Option[];
  fuels: Option[];
  transmissions: Option[];
}

export function publicFormOptions(): PublicFormOptions {
  const models = modelsForSelect();
  const enginesByModel: Record<string, Option[]> = {};
  const trimsByModel: Record<string, Option[]> = {};
  for (const { model } of models) {
    enginesByModel[model.id] = enginesForSelect()
      .filter((e) => isEngineCompatible(e.id, model.id) && isEngineOfferedInBrazil(e.id, model.id))
      .map((e) => ({ value: e.id, label: e.name }));
    trimsByModel[model.id] = trimsForSelect()
      .filter(({ trim }) => isTrimCompatible(trim.id, model.id))
      .map(({ trim }) => ({ value: trim.id, label: trim.name }));
  }
  return {
    models: models.map(({ model, isVariant }) => ({
      value: model.id,
      label: isVariant ? `  ${model.name}` : model.name,
    })),
    enginesByModel,
    trimsByModel,
    ufs: Object.entries(UFS).map(([value, name]) => ({ value, label: `${value} · ${name}` })),
    fuels: FUELS.map((f) => ({ value: f, label: FUEL_LABELS[f] })),
    transmissions: TRANSMISSIONS.map((t) => ({ value: t, label: TRANSMISSION_LABELS[t] })),
  };
}

export interface PublicListing {
  modelId: string;
  engineId: string | null;
  trimId: string | null;
  versionText: string | null;
  yearFab: number | null;
  yearModel: number;
  km: number;
  priceCents: number;
  city: string;
  uf: string;
  color: string | null;
  transmission: Transmission | null;
  fuel: Fuel | null;
  options: string[];
  description: string | null;
  sellerType: "loja" | "particular";
  name: string;
  phone: string;
  email: string | null;
  /** CPF of the seller (for shops, of the person responsible). */
  cpf: string;
  cnpj: string | null;
}

export type PublicFormField = keyof PublicListing | "terms";

export type PublicFormErrors = Partial<Record<PublicFormField, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_IN_TEXT = /(https?:\/\/|www\.|[\w.-]+@[\w-]+\.\w|(^|\s)@[a-z0-9._]{3,})/i;

type Input = Record<string, string | undefined>;

const text = (input: Input, key: string, max = 120) => {
  const s = input[key]?.trim().replace(/[ \t]+/g, " ");
  return s ? s.slice(0, max) : null;
};

/** Validates the form. `now` sets the newest model year accepted (next year). */
export function parsePublicListingForm(
  input: Input,
  now = new Date(),
): { ok: true; listing: PublicListing } | { ok: false; errors: PublicFormErrors } {
  const errors: PublicFormErrors = {};
  const maxYear = now.getFullYear() + 1;

  const modelId = text(input, "modelo");
  const options = publicFormOptions();
  if (!modelId || !getModel(modelId) || !options.enginesByModel[modelId])
    errors.modelId = "Escolha o modelo.";
  const engineId = text(input, "motor");
  if (engineId && modelId && !options.enginesByModel[modelId]?.some((e) => e.value === engineId))
    errors.engineId = "Este motor não existe para o modelo.";
  const trimId = text(input, "versao");
  if (trimId && modelId && !options.trimsByModel[modelId]?.some((t) => t.value === trimId))
    errors.trimId = "Esta versão não existe para o modelo.";

  const yearModel = Number(text(input, "ano_modelo"));
  const yearModelOk = Number.isInteger(yearModel) && yearModel >= 1960 && yearModel <= maxYear;
  if (!yearModelOk) errors.yearModel = "Informe o ano-modelo.";
  const yearFabRaw = text(input, "ano_fab");
  const yearFab = yearFabRaw ? Number(yearFabRaw) : null;
  if (
    yearFab !== null &&
    yearModelOk &&
    (!Number.isInteger(yearFab) || yearFab < yearModel - 1 || yearFab > yearModel)
  ) {
    errors.yearFab = "O ano de fabricação é o ano-modelo ou o anterior.";
  }

  const km = parseBRNumber(text(input, "km") ?? "");
  if (!Number.isFinite(km) || km < 0 || km > 2_000_000) errors.km = "Informe a quilometragem.";
  const price = parseBRNumber(text(input, "preco") ?? "");
  if (!Number.isFinite(price) || price < 1000 || price > 20_000_000)
    errors.priceCents = "Informe um preço entre R$ 1.000 e R$ 20 milhões.";

  const city = text(input, "cidade", 80);
  if (!city || city.length < 2) errors.city = "Informe a cidade.";
  const uf = text(input, "uf")?.toUpperCase() ?? "";
  if (!(uf in UFS)) errors.uf = "Escolha a UF.";

  const transmission = text(input, "cambio");
  if (transmission && !TRANSMISSIONS.includes(transmission as Transmission))
    errors.transmission = "Opção inválida.";
  const fuel = text(input, "combustivel");
  if (fuel && !FUELS.includes(fuel as Fuel)) errors.fuel = "Opção inválida.";

  const description =
    input.descricao
      ?.trim()
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n") || null;
  if (description && description.length > 2000)
    errors.description = "Use no máximo 2.000 caracteres.";
  else if (description && (CONTACT_IN_TEXT.test(description) || extractPhones(description).length))
    errors.description =
      "Tire telefone, e-mail, @ ou links da descrição: os interessados falam com a nossa equipe.";

  const sellerType = text(input, "tipo");
  if (sellerType !== "loja" && sellerType !== "particular")
    errors.sellerType = "Diga se é loja ou particular.";
  const name = text(input, "nome", 80);
  if (!name || name.length < 2) errors.name = "Informe o seu nome ou o nome da loja.";
  const phone = normalizePhoneBR(text(input, "whatsapp") ?? "");
  if (!phone) errors.phone = "Informe um WhatsApp válido, com DDD.";
  const email = text(input, "email")?.toLowerCase() ?? null;
  if (email && !EMAIL.test(email)) errors.email = "E-mail inválido.";
  const cpf = parseCpf(input.cpf);
  if (!cpf) errors.cpf = "CPF inválido: confira os números.";
  const cnpjRaw = text(input, "cnpj", 20);
  const cnpj = sellerType === "loja" && cnpjRaw ? parseCnpj(cnpjRaw) : null;
  if (sellerType === "loja" && cnpjRaw && !cnpj)
    errors.cnpj = "CNPJ inválido: confira os números e letras.";
  if (input.termos !== "on") errors.terms = "Para anunciar, aceite os Termos do Anunciante.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    listing: {
      modelId: modelId!,
      engineId,
      trimId,
      versionText: text(input, "versao_texto", 60),
      yearFab,
      yearModel,
      km: Math.round(km),
      priceCents: Math.round(price * 100),
      city: city!,
      uf,
      color: text(input, "cor", 40)?.toLowerCase() ?? null,
      transmission: (transmission as Transmission | null) ?? null,
      fuel: (fuel as Fuel | null) ?? (engineId ? (impliedFuel(engineId) ?? null) : null),
      options: (text(input, "itens", 600) ?? "")
        .split(",")
        .map((o) => o.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
      description,
      sellerType: sellerType as "loja" | "particular",
      name: name!,
      phone: phone!,
      email,
      cpf: cpf!,
      cnpj,
    },
  };
}
