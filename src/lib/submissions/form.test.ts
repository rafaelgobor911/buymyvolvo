import { describe, expect, it } from "vitest";

import { parsePublicListingForm, publicFormOptions } from "./form";

const NOW = new Date("2026-11-18T12:00:00-03:00");

const valid = {
  modelo: "xc60",
  motor: "t8",
  versao: "inscription",
  versao_texto: "Recharge T8",
  ano_fab: "2020",
  ano_modelo: "2021",
  km: "38.000",
  preco: "259.900",
  cidade: "Curitiba",
  uf: "pr",
  cor: "Preto",
  cambio: "automatico",
  combustivel: "",
  itens: "Teto solar, Som Bowers & Wilkins",
  descricao: "Revisões na concessionária, pneus novos.",
  tipo: "particular",
  nome: "Maria Exemplo",
  whatsapp: "(41) 99999-0000",
  email: "",
  cpf: "987.654.321-00",
  cnpj: "",
  termos: "on",
};

describe("publicFormOptions", () => {
  it("offers only what was sold in Brazil, with engines and trims per model", () => {
    const options = publicFormOptions();
    expect(options.models.some((m) => m.value === "xc60")).toBe(true);
    expect(options.models.some((m) => m.value === "v90")).toBe(false); // never sold here
    expect(options.enginesByModel.xc60!.map((e) => e.value)).toContain("t8");
    expect(options.enginesByModel.xc60!.map((e) => e.value)).not.toContain("b5"); // not in Brazil
    expect(options.enginesByModel.ex30!.map((e) => e.value)).not.toContain("t8");
  });
});

describe("parsePublicListingForm", () => {
  it("normalizes a complete listing (the engine implies the fuel)", () => {
    expect(parsePublicListingForm(valid, NOW)).toEqual({
      ok: true,
      listing: {
        modelId: "xc60",
        engineId: "t8",
        trimId: "inscription",
        versionText: "Recharge T8",
        yearFab: 2020,
        yearModel: 2021,
        km: 38000,
        priceCents: 25_990_000,
        city: "Curitiba",
        uf: "PR",
        color: "preto",
        transmission: "automatico",
        fuel: "hibrido_plugin",
        options: ["teto solar", "som bowers & wilkins"],
        description: "Revisões na concessionária, pneus novos.",
        sellerType: "particular",
        name: "Maria Exemplo",
        phone: "+5541999990000",
        email: null,
        cpf: "98765432100",
        cnpj: null,
      },
    });
  });

  it("requires the essentials and the terms", () => {
    const result = parsePublicListingForm(
      {
        ...valid,
        modelo: "",
        ano_modelo: "",
        km: "",
        preco: "500",
        cidade: "",
        uf: "XX",
        tipo: "",
        nome: "",
        whatsapp: "123",
        termos: "",
      },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      [
        "city",
        "km",
        "modelId",
        "name",
        "phone",
        "priceCents",
        "sellerType",
        "terms",
        "uf",
        "yearModel",
      ].sort(),
    );
  });

  it("rejects an engine of another model, an odd year pair and contacts in the description", () => {
    const result = parsePublicListingForm(
      {
        ...valid,
        modelo: "ex30",
        motor: "t8",
        versao: "",
        ano_fab: "2019",
        ano_modelo: "2025",
        descricao: "Chama no zap (41) 99999-1234 ou no @lojaexemplo",
      },
      NOW,
    );
    expect(result).toMatchObject({
      ok: false,
      errors: {
        engineId: "Este motor não existe para o modelo.",
        yearFab: "O ano de fabricação é o ano-modelo ou o anterior.",
        description: expect.stringMatching(/Tire telefone, e-mail, @ ou links/),
      },
    });
    for (const descricao of [
      "veja em https://exemplo.com",
      "contato@exemplo.com",
      "www.loja.com",
    ]) {
      expect(parsePublicListingForm({ ...valid, descricao }, NOW)).toMatchObject({ ok: false });
    }
  });

  it("checks the CPF (always) and the CNPJ (shops, when given) by their digits", () => {
    expect(parsePublicListingForm({ ...valid, cpf: "987.654.321-01" }, NOW)).toMatchObject({
      ok: false,
      errors: { cpf: "CPF inválido: confira os números." },
    });
    expect(
      parsePublicListingForm({ ...valid, tipo: "loja", cnpj: "11.222.333/0001-82" }, NOW),
    ).toMatchObject({ ok: false, errors: { cnpj: "CNPJ inválido: confira os números e letras." } });
    expect(
      parsePublicListingForm({ ...valid, tipo: "loja", cnpj: "12.ABC.345/01DE-35" }, NOW),
    ).toMatchObject({ ok: true, listing: { cnpj: "12ABC34501DE35" } });
    // A CNPJ typed by a private seller is ignored.
    expect(parsePublicListingForm({ ...valid, cnpj: "11.222.333/0001-81" }, NOW)).toMatchObject({
      ok: true,
      listing: { cnpj: null },
    });
  });
});
