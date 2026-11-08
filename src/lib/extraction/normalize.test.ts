import { describe, expect, it } from "vitest";

import {
  extractPhones,
  hasMinimumFields,
  normalizeExtraction,
  normalizeKm,
  normalizePhoneBR,
  normalizePrice,
  normalizeYears,
} from "./normalize";
import type { Extraction } from "./schema";

const NOW = new Date("2026-11-08T12:00:00-03:00");

const ext = (over: Partial<Extraction> = {}): Extraction => ({
  is_vehicle_for_sale: true,
  confidence: 0.95,
  model: "XC60",
  engine: "T8",
  trim: "Inscription",
  version_text: "T8 Inscription",
  year_fab: 2019,
  year_model: 2020,
  km: 41000,
  km_text: "41.000 km",
  price: 239900,
  price_text: "R$ 239.900",
  city: "Curitiba",
  uf: "PR",
  color: "Preto",
  transmission: "automatico",
  fuel: "hibrido_plugin",
  options: ["teto solar panorâmico"],
  seller_type: "particular",
  phones: ["(41) 90000-0001"],
  summary_ptbr: "SUV híbrido plug-in em bom estado, com manutenção em dia na rede autorizada.",
  red_flags: [],
  ...over,
});

const caption = "XC60 T8 Inscription 19/20, 41.000 km, R$ 239.900. (41) 90000-0001";
const norm = (over: Partial<Extraction> = {}, c = caption) =>
  normalizeExtraction(ext(over), { caption: c, now: NOW });

describe("phones", () => {
  it.each([
    ["(41) 90000-0001", "+5541900000001"],
    ["41 90000-0001", "+5541900000001"],
    ["+55 11 90000-0013", "+5511900000013"],
    ["041 90000-0001", "+5541900000001"],
    ["(41) 3000-0004", "+554130000004"],
    ["(41) 8800-0001", "+5541988000001"],
  ])("%s → %s", (raw, e164) => {
    expect(normalizePhoneBR(raw)).toBe(e164);
  });

  it.each(["(20) 90000-0001", "12345", "(41) 10000-0001", "+54 9 11 0000-0034"])(
    "rejects %s",
    (raw) => {
      expect(normalizePhoneBR(raw)).toBeNull();
    },
  );

  it("finds phones inside free text", () => {
    expect(extractPhones("zap 41 90000-0002 ou (11) 3000-0004 obrigado")).toEqual([
      "+5541900000002",
      "+551130000004",
    ]);
  });
});

describe("numbers", () => {
  it.each([
    ["R$ 189.900,00", null, 189_900],
    ["189k", null, 189_000],
    ["189 mil", null, 189_000],
    ["R$189900", null, 189_900],
    ["1️⃣4️⃣5️⃣ mil", null, 145_000],
    [null, 165_000, 165_000],
    ["165k", 165, 165_000],
  ])("price %s / %s → %s", (text, value, expected) => {
    expect(normalizePrice(text, value)).toBe(expected);
  });

  it("drops implausible prices", () => {
    expect(normalizePrice("R$ 1", 1)).toBeNull();
    expect(normalizePrice(null, 900_000_000)).toBeNull();
  });

  it.each([
    ["58mil km", null, 58_000],
    ["58.000 km", null, 58_000],
    ["46k km", null, 46_000],
    [null, 92_000, 92_000],
  ])("km %s / %s → %s", (text, value, expected) => {
    expect(normalizeKm(text, value)).toBe(expected);
  });

  it("years: 2-digit, single year, reversed and invalid", () => {
    expect(normalizeYears(19, 20, NOW)).toEqual({ yearFab: 2019, yearModel: 2020, ok: true });
    expect(normalizeYears(2019, null, NOW)).toEqual({ yearFab: 2019, yearModel: 2019, ok: true });
    expect(normalizeYears(2020, 2019, NOW)).toEqual({ yearFab: 2019, yearModel: 2020, ok: true });
    expect(normalizeYears(2015, 2019, NOW).ok).toBe(false);
    expect(normalizeYears(2035, null, NOW).ok).toBe(false);
  });
});

describe("normalizeExtraction", () => {
  it("maps a clean answer to taxonomy ids and database fields", () => {
    const n = norm();
    expect(n).toMatchObject({
      modelId: "xc60",
      engineId: "t8",
      trimId: "inscription",
      yearFab: 2019,
      yearModel: 2020,
      km: 41_000,
      priceCents: 23_990_000,
      city: "Curitiba",
      uf: "PR",
      color: "preto",
      contactPhone: "+5541900000001",
      confidence: 0.95,
      issues: [],
    });
    expect(hasMinimumFields(n)).toBe(true);
  });

  it("matches spelling variants and typos", () => {
    expect(norm({ model: "XC 60", trim: "R-Desing", engine: "t8" }).trimId).toBe("r-design");
    expect(norm({ model: "Volvo XC6O" }).modelId).toBe("xc60");
    expect(
      norm({
        model: "V40 Cross Country",
        engine: "T5",
        trim: null,
        year_fab: 2018,
        year_model: 2018,
      }).modelId,
    ).toBe("v40-cc");
  });

  it("reads the state from the city field when the model left uf empty", () => {
    const place = (city: string | null, uf: string | null = null) => {
      const n = norm({ city, uf });
      return { city: n.city, uf: n.uf };
    };
    expect(place("São Paulo")).toEqual({ city: "São Paulo", uf: "SP" });
    expect(place("Rio de Janeiro/RJ")).toEqual({ city: "Rio de Janeiro", uf: "RJ" });
    expect(place("Sampa")).toEqual({ city: "São Paulo", uf: "SP" });
    expect(place("RJ")).toEqual({ city: null, uf: "RJ" });
    expect(place("Paraná")).toEqual({ city: null, uf: "PR" });
    expect(place("Toledo PR")).toEqual({ city: "Toledo PR", uf: "PR" });
    expect(place("Ctba", "PR")).toEqual({ city: "Ctba", uf: "PR" });
    expect(norm({ city: "São Paulo", uf: "PR" }).issues.map((i) => i.code)).toContain(
      "place_mismatch",
    );
  });

  it("writes colors in the masculine singular", () => {
    expect(norm({ color: "Vermelha" }).color).toBe("vermelho");
    expect(norm({ color: "preta metálica" }).color).toBe("preto metálico");
    expect(norm({ color: "amarelo creme" }).color).toBe("amarelo creme");
    expect(norm({ color: "cinza" }).color).toBe("cinza");
    expect(norm({ color: "  " }).color).toBeNull();
  });

  it("sends a public summary with contact data to moderation and flags a price", () => {
    const codes = (summary_ptbr: string) => norm({ summary_ptbr }).issues.map((i) => i.code);
    expect(codes("SUV híbrido com 41 mil km rodados e revisões em dia.")).toEqual([]);
    expect(codes("Sedã com cerca de 102 mil quilômetros, bem conservado.")).toEqual([]);
    expect(codes("Bem conservado. Chame no WhatsApp (41) 90000-0001.")).toEqual([]);
    expect(codes("Carro da loja @nordica.veiculos, revisado.")).toContain("summary_contact");
    expect(codes("Coupé raro, à venda por 55 mil reais.")).toEqual(["summary_price"]);
    expect(codes("Oferecido por R$ 89.900 com IPVA pago.")).toEqual(["summary_price"]);
    const leaked = norm({ summary_ptbr: "Contato pelo zap 41 90000-0001." });
    expect(leaked.confidence).toBeLessThan(0.85);
  });

  it("drops sentences that only say how to contact the seller", () => {
    expect(
      norm({
        summary_ptbr:
          "SUV elétrico de 2022 com bateria em ótimo estado. O contato é feito pelo direct ou telefone indicado no anúncio.",
      }).summary,
    ).toBe("SUV elétrico de 2022 com bateria em ótimo estado.");
    expect(
      norm({ summary_ptbr: "Bem conservado. Chame no WhatsApp (41) 90000-0001. Aceita troca." })
        .summary,
    ).toBe("Bem conservado. Aceita troca.");
    expect(norm({ summary_ptbr: "Contato só pelo direct." }).summary).toBe(
      "Contato só pelo direct.",
    );
  });

  it("does not penalize a price on request", () => {
    const onRequest = norm({ price: null, price_text: "Consulte valor!" });
    expect(onRequest.priceCents).toBeNull();
    expect(onRequest.issues).toEqual([]);
    expect(norm({ price: 0, price_text: "sob consulta" }).issues).toEqual([]);
    expect(norm({ price: 1, price_text: "R$ 1" }).issues.map((i) => i.code)).toEqual([
      "price_invalid",
    ]);
  });

  it("prefers the price snippet over a wrong number from the model", () => {
    expect(norm({ price: 1, price_text: "R$ 159.900" }).priceCents).toBe(15_990_000);
  });

  it("derives fuel from the engine and fixes conflicts", () => {
    expect(norm({ fuel: null }).fuel).toBe("hibrido_plugin");
    const conflict = norm({ fuel: "diesel" });
    expect(conflict.fuel).toBe("hibrido_plugin");
    expect(conflict.issues.map((i) => i.code)).toContain("fuel_mismatch");
  });

  it("penalizes combinations that do not exist or were not sold in Brazil", () => {
    const b5 = norm({ engine: "B5", trim: null, year_fab: 2022, year_model: 2022, fuel: null });
    expect(b5.issues.map((i) => i.code)).toContain("engine_not_in_brazil");
    expect(b5.confidence).toBeLessThan(0.85);

    const t8OldXc60 = norm({ year_fab: 2014, year_model: 2014, trim: null });
    expect(t8OldXc60.issues.map((i) => i.code)).toContain("engine_mismatch");

    const v90 = norm({ model: "V90", engine: "T6", trim: null, fuel: null });
    expect(v90.issues.map((i) => i.code)).toContain("model_not_in_brazil");
  });

  it("flags a summary that copies the caption", () => {
    const n = norm(
      {
        summary_ptbr:
          "Lindo XC60 T8 Inscription com revisões em dia na concessionária e teto panorâmico B&W",
      },
      "Lindo XC60 T8 Inscription com revisões em dia na concessionária e teto panorâmico B&W, R$ 239.900",
    );
    expect(n.issues.map((i) => i.code)).toContain("summary_copied");
    expect(n.confidence).toBeLessThan(0.7);
  });

  it("adds rule-based red flags and the missing-contact flag", () => {
    const n = norm(
      { phones: [] },
      "REPASSE XC60 T8 2020, IPVA atrasado, pix de sinal para reservar. R$ 150.000",
    );
    expect(n.redFlags).toEqual(
      expect.arrayContaining(["repasse", "documento_pendente", "pedido_de_sinal", "sem_contato"]),
    );
  });

  it("uses the Instagram username as contact when there is no phone", () => {
    const n = normalizeExtraction(ext({ phones: [] }), {
      caption: "XC60 T8 2020 R$ 239.900 chama no direct",
      igUsername: "@Loja.Exemplo",
      now: NOW,
    });
    expect(n.contactPhone).toBeNull();
    expect(n.contactIgUsername).toBe("loja.exemplo");
    expect(n.redFlags).not.toContain("sem_contato");
  });

  it("falls back to a phone in the profile bio", () => {
    const n = normalizeExtraction(ext({ phones: [] }), {
      caption: "XC60 T8 2020 R$ 239.900",
      bio: "Loja de importados · WhatsApp (11) 90000-0099",
      now: NOW,
    });
    expect(n.contactPhone).toBe("+5511900000099");
  });

  it("cannot publish a post that is not a listing", () => {
    const n = norm({ is_vehicle_for_sale: false, model: null, engine: null, trim: null });
    expect(n.isListing).toBe(false);
    expect(hasMinimumFields(n)).toBe(false);
  });
});
