import { describe, expect, it } from "vitest";

import { parseAcceptForm } from "./data";

const valid = {
  name: "  Loja   Exemplo ",
  type: "loja",
  phone: "(41) 99999-0000",
  email: " Contato@Exemplo.com ",
  terms: true,
  alsoIds: [],
};

describe("parseAcceptForm", () => {
  it("normalizes a valid authorization", () => {
    expect(parseAcceptForm(valid)).toEqual({
      ok: true,
      name: "Loja Exemplo",
      type: "loja",
      phone: "+5541999990000",
      email: "contato@exemplo.com",
    });
    expect(parseAcceptForm({ ...valid, email: "" })).toMatchObject({ ok: true, email: null });
  });

  it("requires a name, the seller type, a valid WhatsApp and the terms", () => {
    expect(
      parseAcceptForm({ name: "", type: "", phone: "123", email: "x@", terms: false, alsoIds: [] }),
    ).toEqual({
      ok: false,
      errors: {
        name: "Informe o seu nome ou o nome da loja.",
        type: "Diga se é loja ou particular.",
        phone: "Informe um WhatsApp válido, com DDD.",
        email: "E-mail inválido.",
        terms: "Para autorizar, aceite os Termos do Anunciante.",
      },
    });
  });
});
