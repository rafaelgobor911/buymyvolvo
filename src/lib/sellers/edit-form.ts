/**
 * What a seller may change on a claimed listing, validated. Pure (no I/O).
 * The car's identity (model, engine, version, years) stays with the admin.
 */
import { parseBRNumber } from "@/lib/admin/listing-form";
import { normalizePhoneBR } from "@/lib/extraction/normalize";
import { UFS } from "@/lib/search/places";
import { type Fuel, FUELS, type Transmission, TRANSMISSIONS } from "@/lib/taxonomy";

export interface SellerEdit {
  priceCents: number | null;
  km: number | null;
  color: string | null;
  transmission: Transmission | null;
  fuel: Fuel | null;
  city: string | null;
  uf: string | null;
  phone: string | null;
  igUsername: string | null;
  description: string | null;
  options: string[];
}

export const SELLER_EDIT_LABELS: Record<keyof SellerEdit, string> = {
  priceCents: "Preço",
  km: "Km",
  color: "Cor",
  transmission: "Câmbio",
  fuel: "Combustível",
  city: "Cidade",
  uf: "UF",
  phone: "WhatsApp",
  igUsername: "Instagram",
  description: "Descrição",
  options: "Itens",
};

type Input = Record<string, string | undefined>;

const text = (input: Input, key: string, max = 120) => {
  const s = input[key]?.trim().replace(/[ \t]+/g, " ");
  return s ? s.slice(0, max) : null;
};

export type SellerEditResult =
  { ok: true; edit: SellerEdit } | { ok: false; errors: Partial<Record<keyof SellerEdit, string>> };

export function parseSellerEdit(input: Input, current: { phone: string | null }): SellerEditResult {
  const errors: Partial<Record<keyof SellerEdit, string>> = {};

  const priceRaw = text(input, "preco");
  const price = priceRaw ? parseBRNumber(priceRaw) : null;
  if (price !== null && (!Number.isFinite(price) || price < 1000 || price > 20_000_000)) {
    errors.priceCents = "Informe um preço entre R$ 1.000 e R$ 20 milhões.";
  }
  const kmRaw = text(input, "km");
  const km = kmRaw ? parseBRNumber(kmRaw) : null;
  if (km !== null && (!Number.isFinite(km) || km < 0 || km > 2_000_000)) errors.km = "Km inválido.";

  const transmission = text(input, "cambio");
  if (transmission && !TRANSMISSIONS.includes(transmission as Transmission))
    errors.transmission = "Opção inválida.";
  const fuel = text(input, "combustivel");
  if (fuel && !FUELS.includes(fuel as Fuel)) errors.fuel = "Opção inválida.";
  const uf = text(input, "uf")?.toUpperCase() ?? null;
  if (uf && !(uf in UFS)) errors.uf = "UF inválida.";

  let phone: string | null = null;
  const rawPhone = text(input, "telefone");
  if (rawPhone) {
    if (current.phone && rawPhone.replace(/\D/g, "") === current.phone.replace(/\D/g, "")) {
      phone = current.phone;
    } else {
      phone = normalizePhoneBR(rawPhone);
      if (!phone) errors.phone = "Telefone brasileiro inválido (DDD + número).";
    }
  }
  const ig = text(input, "instagram")?.replace(/^@/, "").toLowerCase() ?? null;
  if (ig && !/^[a-z0-9._]{1,30}$/.test(ig)) errors.igUsername = "@ inválido.";

  const description =
    input.descricao
      ?.trim()
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n") || null;
  if (description && description.length > 2000)
    errors.description = "Use no máximo 2.000 caracteres.";

  if (Object.keys(errors).length) return { ok: false, errors };
  if (price === null && !phone && !ig) {
    return {
      ok: false,
      errors: { priceCents: "Informe o preço ou um contato (WhatsApp ou Instagram)." },
    };
  }
  return {
    ok: true,
    edit: {
      priceCents: price === null ? null : Math.round(price * 100),
      km: km === null ? null : Math.round(km),
      color: text(input, "cor", 40)?.toLowerCase() ?? null,
      transmission: (transmission as Transmission | null) ?? null,
      fuel: (fuel as Fuel | null) ?? null,
      city: text(input, "cidade", 80),
      uf,
      phone,
      igUsername: ig,
      description,
      options: (text(input, "itens", 600) ?? "")
        .split(",")
        .map((o) => o.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
    },
  };
}
