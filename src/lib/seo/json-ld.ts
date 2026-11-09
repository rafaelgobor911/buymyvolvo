/**
 * Structured data (schema.org JSON-LD). Pure: callers pass absolute URLs.
 * Only what the page itself shows; no phone, no Instagram photos.
 */
import { FUEL_LABELS, type Fuel, TRANSMISSION_LABELS, type Transmission } from "@/lib/taxonomy";

/** JSON for a <script type="application/ld+json">, with "<" escaped (no </script> breakout). */
export const serializeJsonLd = (data: unknown) =>
  JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export interface CarJsonLdInput {
  url: string;
  name: string;
  modelName: string;
  engineName: string | null;
  yearFab: number | null;
  yearModel: number | null;
  km: number | null;
  priceCents: number | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  color: string | null;
  city: string | null;
  uf: string | null;
  description: string | null;
  /** Absolute URLs of the seller's licensed photos (claimed listings only). */
  images: string[];
  /** Seller's public name (claimed listings only). */
  seller: { name: string; type: "loja" | "particular" | "desconhecido" } | null;
  available: boolean;
}

const compact = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
    ),
  ) as Partial<T>;

export function carJsonLd(input: CarJsonLdInput) {
  const address =
    input.city || input.uf
      ? compact({
          "@type": "PostalAddress",
          addressLocality: input.city,
          addressRegion: input.uf,
          addressCountry: "BR",
        })
      : null;
  const offer =
    input.priceCents === null
      ? null
      : compact({
          "@type": "Offer",
          url: input.url,
          price: input.priceCents / 100,
          priceCurrency: "BRL",
          availability: input.available
            ? "https://schema.org/InStock"
            : "https://schema.org/SoldOut",
          itemCondition: "https://schema.org/UsedCondition",
          availableAtOrFrom: address ? { "@type": "Place", address } : null,
          seller: input.seller
            ? {
                "@type": input.seller.type === "loja" ? "AutoDealer" : "Person",
                name: input.seller.name,
              }
            : null,
        });
  return compact({
    "@context": "https://schema.org",
    "@type": "Car",
    name: input.name,
    url: input.url,
    brand: { "@type": "Brand", name: "Volvo" },
    model: input.modelName,
    vehicleModelDate: input.yearModel ? String(input.yearModel) : null,
    productionDate: input.yearFab ? String(input.yearFab) : null,
    vehicleEngine: input.engineName
      ? { "@type": "EngineSpecification", name: input.engineName }
      : null,
    mileageFromOdometer:
      input.km === null ? null : { "@type": "QuantitativeValue", value: input.km, unitCode: "KMT" },
    fuelType: input.fuel ? FUEL_LABELS[input.fuel] : null,
    vehicleTransmission: input.transmission ? TRANSMISSION_LABELS[input.transmission] : null,
    color: input.color,
    itemCondition: "https://schema.org/UsedCondition",
    description: input.description,
    image: input.images,
    offers: offer,
  });
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteJsonLd(input: { name: string; url: string; instagram: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    url: input.url,
    inLanguage: "pt-BR",
    publisher: {
      "@type": "Organization",
      name: input.name,
      url: input.url,
      sameAs: [`https://www.instagram.com/${input.instagram}/`],
    },
  };
}
