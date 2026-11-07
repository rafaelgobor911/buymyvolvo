/** Formatting helpers shared by pages, seeds and tests (pt-BR). */

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listingSlug(
  parts: {
    modelName: string;
    engineName?: string | null;
    trimName?: string | null;
    yearModel?: number | null;
    city?: string | null;
    uf?: string | null;
  },
  shortId: string,
): string {
  return slugify(
    [
      "volvo",
      parts.modelName,
      parts.engineName,
      parts.trimName,
      parts.yearModel,
      parts.city,
      parts.uf,
      shortId,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("pt-BR");

export const formatPrice = (cents: number | null | undefined) =>
  cents == null ? "Preço não informado" : brl.format(Math.round(cents / 100));

export const formatKm = (km: number | null | undefined) =>
  km == null ? "km não informado" : `${integer.format(km)} km`;

export const formatInteger = (value: number) => integer.format(value);

export function formatYears(
  yearFab: number | null | undefined,
  yearModel: number | null | undefined,
) {
  if (yearFab && yearModel && yearFab !== yearModel) return `${yearFab}/${yearModel}`;
  return String(yearModel ?? yearFab ?? "Ano não informado");
}

/** "hoje", "ontem", "há 5 dias", "há 2 meses". */
export function formatRelativeDays(date: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 60) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return `há ${months} meses`;
}

export function formatPlace(city: string | null | undefined, uf: string | null | undefined) {
  if (city && uf) return `${city}, ${uf}`;
  return city ?? uf ?? "Local não informado";
}
