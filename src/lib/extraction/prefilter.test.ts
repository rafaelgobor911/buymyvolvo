import { describe, expect, it } from "vitest";

import { EVAL_CASES } from "../../../evals/extraction/dataset";

import { prefilter } from "./prefilter";

describe("prefilter on the gold dataset", () => {
  it.each(EVAL_CASES.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(prefilter(c.caption).pass).toBe(c.expected.prefilter);
  });
});

describe("prefilter reasons", () => {
  it.each([
    ["Que fim de tarde com a nossa V40! 🌅", "no_sale_signal"],
    ["Vendo Honda Civic 2018 R$ 80.000", "not_volvo"],
    ["Procuro XC60 até 200 mil", "wanted_ad"],
    ["VENDIDO! XC90 entregue", "sold"],
    ["2019 Volvo XC60 for sale $38,500, DM", "not_brazil"],
    ["Vendo meu Volvo XC60 2015, R$ 90.000", "ok"],
  ])("%s → %s", (caption, reason) => {
    expect(prefilter(caption).reason).toBe(reason);
  });

  it("does not take numbers like 850 for a model unless Volvo is mentioned", () => {
    expect(prefilter("Vendo moto 850cc, 12.000 km, R$ 30.000").reason).toBe("not_volvo");
    expect(prefilter("Volvo 850 GLT 1996, R$ 25.000").reason).toBe("ok");
  });
});

describe("prefilter by origin", () => {
  // Synthetic captions shaped like posts seen on the real API (nov/2026).
  const spanish =
    "🚘 VOLVO XC60 B4 D PLUS DARK AUTO | 04/2023 | 79.120 KM | Cambio automático | Precio: 32.900€ | Financiación disponible";
  const italian =
    "VOLVO XC40 D3 BUSINESS — 10/2019, 133.000 km, cambio automatico, interni misto pelle. Prezzo 17.900 euro";
  const angolan =
    "VOLVO XC60 R-DESIGN (2015) – viatura impecável, revisões na marca, 98.000 km. Preço: 18.500.000 Kz. Luanda";
  const brazilianWithPrice = "Vendo XC60 T5 2018, 72 mil km, revisado. R$ 139.000. Aceito troca";
  const brazilianNoPrice = "XC60 T8 2021 impecável, 40 mil km, aceito troca. Chama no direct";
  const shopNoPrice =
    "Volvo XC60 T8 Ultra 2025/2026 com 8.802 km, único dono, revisões na concessionária";

  it("drops foreign posts from hashtags", () => {
    for (const caption of [spanish, italian, angolan]) {
      expect(prefilter(caption, { origin: "hashtag" }).reason).toBe("not_brazil");
    }
  });

  it("asks hashtag posts for R$, +55 or a DDD phone", () => {
    expect(prefilter(brazilianWithPrice, { origin: "hashtag" }).reason).toBe("ok");
    expect(
      prefilter("XC40 T4 2020, 41 mil km. Zap (41) 90000-0202", { origin: "hashtag" }).reason,
    ).toBe("ok");
    expect(prefilter(brazilianNoPrice, { origin: "hashtag" }).reason).toBe("not_brazil");
    // Without an origin the weaker rule still accepts Portuguese sale words.
    expect(prefilter(brazilianNoPrice).reason).toBe("ok");
  });

  it("trusts the curated shops, which are Brazilian", () => {
    expect(prefilter(shopNoPrice, { origin: "business_discovery" }).reason).toBe("ok");
    expect(prefilter(shopNoPrice, { origin: "hashtag" }).reason).toBe("not_brazil");
  });

  it("counts state codes only in uppercase", () => {
    expect(prefilter("Volvo XC60 2019 es una joya, 50.000 km").reason).toBe("not_brazil");
    expect(prefilter("Volvo XC60 2019, 50.000 km, Curitiba-PR").reason).toBe("ok");
  });
});
