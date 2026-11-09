import { describe, expect, it } from "vitest";

import { parseSellerEdit } from "./edit-form";

const base = {
  preco: "259.900",
  km: "6.000",
  cor: "Azul",
  cambio: "automatico",
  combustivel: "eletrico",
  cidade: "Florianópolis",
  uf: "sc",
  telefone: "+5520910000029",
  instagram: "@Loja.Floripa",
  descricao: "Carro de garagem.\r\n\r\n\r\n\r\nPneus novos.",
  itens: "Teto panorâmico, , Bomba de calor",
};

describe("parseSellerEdit", () => {
  it("normalizes the seller's edits and keeps the stored (demo) phone", () => {
    const result = parseSellerEdit(base, { phone: "+5520910000029" });
    expect(result).toEqual({
      ok: true,
      edit: {
        priceCents: 25_990_000,
        km: 6000,
        color: "azul",
        transmission: "automatico",
        fuel: "eletrico",
        city: "Florianópolis",
        uf: "SC",
        phone: "+5520910000029",
        igUsername: "loja.floripa",
        description: "Carro de garagem.\n\nPneus novos.",
        options: ["teto panorâmico", "bomba de calor"],
      },
    });
  });

  it("validates price, phone, @ and description length", () => {
    const result = parseSellerEdit(
      {
        ...base,
        preco: "500",
        telefone: "(20) 91000-0099",
        instagram: "a b",
        descricao: "x".repeat(2001),
        uf: "ZZ",
      },
      { phone: "+5520910000029" },
    );
    expect(result.ok === false && Object.keys(result.errors).sort()).toEqual(
      ["description", "igUsername", "phone", "priceCents", "uf"].sort(),
    );
  });

  it("an active listing keeps a price or a contact", () => {
    const result = parseSellerEdit({ preco: "", telefone: "", instagram: "" }, { phone: null });
    expect(result.ok === false && result.errors.priceCents).toMatch(/preço ou um contato/);
  });
});
