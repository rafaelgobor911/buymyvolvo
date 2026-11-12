import { describe, expect, it } from "vitest";

import { parseAcceptForm } from "./data";

const valid = {
  name: "  Loja   Exemplo ",
  type: "loja",
  phone: "(41) 99999-0000",
  email: " Contato@Exemplo.com ",
  cpf: "987.654.321-00",
  cnpj: "11.222.333/0001-81",
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
      cpf: "98765432100",
      cnpj: "11222333000181",
    });
    expect(parseAcceptForm({ ...valid, email: "" })).toMatchObject({ ok: true, email: null });
  });

  it("requires a name, the seller type, a valid WhatsApp and the terms", () => {
    expect(
      parseAcceptForm({
        name: "",
        type: "",
        phone: "123",
        email: "x@",
        cpf: "111.111.111-11",
        cnpj: "",
        terms: false,
        alsoIds: [],
      }),
    ).toEqual({
      ok: false,
      errors: {
        name: "Informe o seu nome ou o nome da loja.",
        type: "Diga se é loja ou particular.",
        phone: "Informe um WhatsApp válido, com DDD.",
        email: "E-mail inválido.",
        cpf: "CPF inválido: confira os números.",
        terms: "Para autorizar, aceite os Termos do Anunciante.",
      },
    });
  });
});
