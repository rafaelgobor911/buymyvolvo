import { describe, expect, it } from "vitest";

import { type FormInput, parseBRNumber, parseListingForm, publishable } from "./listing-form";

const base: FormInput = {
  modelo: "xc60",
  motor: "t8",
  versao: "polestar-engineered",
  versao_texto: "T8 Polestar Engineered",
  ano_fab: "2020",
  ano_modelo: "2021",
  km: "30.000",
  preco: "R$ 295.000",
  cidade: "São  Paulo",
  uf: "sp",
  cor: "Branco",
  cambio: "automatico",
  combustivel: "hibrido_plugin",
  vendedor: "loja",
  telefone: "(11) 98765-4321",
  instagram: "@Loja.Volvo",
  resumo: "SUV híbrido com revisões na concessionária.",
  alertas: ["repasse", "inventado"],
  itens: "Teto panorâmico, som Bowers & Wilkins, ",
};

describe("parseBRNumber", () => {
  it.each([
    ["295.000", 295000],
    ["R$ 295.000,00", 295000],
    ["189.900,50", 189900.5],
    ["295000", 295000],
    ["abc", NaN],
  ])("%s → %s", (raw, expected) => expect(parseBRNumber(raw)).toBe(expected));
});

describe("parseListingForm", () => {
  it("normalizes a valid form", () => {
    const result = parseListingForm(base);
    expect(result).toEqual({
      ok: true,
      warnings: [],
      patch: {
        modelId: "xc60",
        engineId: "t8",
        trimId: "polestar-engineered",
        versionText: "T8 Polestar Engineered",
        yearFab: 2020,
        yearModel: 2021,
        km: 30000,
        priceCents: 29_500_000,
        city: "São Paulo",
        uf: "SP",
        color: "branco",
        transmission: "automatico",
        fuel: "hibrido_plugin",
        sellerType: "loja",
        phone: "+5511987654321",
        igUsername: "loja.volvo",
        summary: "SUV híbrido com revisões na concessionária.",
        redFlags: ["repasse"],
        options: ["teto panorâmico", "som bowers & wilkins"],
      },
    });
  });

  it("blocks impossible values with a message per field", () => {
    const result = parseListingForm({
      ...base,
      modelo: "fusca",
      ano_fab: "2020",
      ano_modelo: "2023",
      preco: "12",
      uf: "XX",
      telefone: "1234",
      instagram: "nome com espaço",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      ["igUsername", "modelId", "phone", "priceCents", "uf", "yearModel"].sort(),
    );
  });

  it("keeps the stored phone (demo DDD 20) but validates a new one", () => {
    const current = { phone: "+5520910000064" };
    const kept = parseListingForm({ ...base, telefone: "+5520910000064" }, current);
    expect(kept.ok && kept.patch.phone).toBe("+5520910000064");
    const fake = parseListingForm({ ...base, telefone: "(20) 91000-0099" }, current);
    expect(fake.ok).toBe(false);
  });

  it("warns, without blocking, on combinations that look wrong", () => {
    const result = parseListingForm({ ...base, modelo: "v40", motor: "t8", versao: "" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.warnings[0]).toMatch(/T8 não combina com V40/);
  });

  it("empty optional fields become null and the seller type defaults to unknown", () => {
    const result = parseListingForm({ modelo: "xc40" });
    expect(result.ok && result.patch).toMatchObject({
      engineId: null,
      yearModel: null,
      priceCents: null,
      phone: null,
      sellerType: "desconhecido",
      redFlags: [],
      options: [],
    });
  });
});

describe("publishable", () => {
  it("needs the model year and a price or a contact", () => {
    const empty = { yearModel: null, priceCents: null, phone: null, igUsername: null };
    expect(publishable(empty)).toBe(false);
    expect(publishable({ ...empty, yearModel: 2020 })).toBe(false);
    expect(publishable({ ...empty, yearModel: 2020, igUsername: "loja" })).toBe(true);
    expect(publishable({ ...empty, yearModel: 2020, priceCents: 100 })).toBe(true);
  });
});
