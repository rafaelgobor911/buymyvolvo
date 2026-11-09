import { describe, expect, it } from "vitest";

import { breadcrumbJsonLd, carJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";

const base = {
  url: "https://buymyvolvo.com.br/anuncio/volvo-xc60-t8-2020-sp-abc12",
  name: "Volvo XC60 T8 Inscription",
  modelName: "XC60",
  engineName: "T8",
  yearFab: 2019,
  yearModel: 2020,
  km: 45000,
  priceCents: 25_000_000,
  fuel: "hibrido_plugin" as const,
  transmission: "automatico" as const,
  color: "preto",
  city: "São Paulo",
  uf: "SP",
  description: "Revisado na concessionária.",
  images: [],
  seller: null,
  available: true,
};

describe("carJsonLd", () => {
  it("describes the car and the offer", () => {
    const data = carJsonLd(base);
    expect(data).toMatchObject({
      "@type": "Car",
      brand: { "@type": "Brand", name: "Volvo" },
      vehicleModelDate: "2020",
      productionDate: "2019",
      mileageFromOdometer: { value: 45000, unitCode: "KMT" },
      fuelType: "Híbrido plug-in",
      vehicleTransmission: "Automático",
      offers: {
        "@type": "Offer",
        price: 250000,
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
        availableAtOrFrom: {
          address: { addressLocality: "São Paulo", addressRegion: "SP", addressCountry: "BR" },
        },
      },
    });
    expect(data).not.toHaveProperty("image");
    expect(data.offers).not.toHaveProperty("seller");
  });

  it("leaves out the offer without a price and adds the verified seller", () => {
    expect(carJsonLd({ ...base, priceCents: null })).not.toHaveProperty("offers");
    const claimed = carJsonLd({
      ...base,
      images: ["https://cdn.example/a.webp"],
      seller: { name: "Loja Teste", type: "loja" },
    });
    expect(claimed.image).toEqual(["https://cdn.example/a.webp"]);
    expect(claimed.offers).toMatchObject({ seller: { "@type": "AutoDealer", name: "Loja Teste" } });
  });
});

describe("serializeJsonLd", () => {
  it("cannot close the script tag", () => {
    const out = serializeJsonLd({ description: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ description: "</script><script>alert(1)</script>" });
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Volvo à venda", url: "https://x/volvo" },
        { name: "XC60", url: "https://x/volvo/xc60" },
      ]).itemListElement.map((i) => i.position),
    ).toEqual([1, 2]);
  });
});
