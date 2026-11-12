import { describe, expect, it } from "vitest";

import { parseManualForm } from "./manual";

const TEXT = "Vendo Volvo XC60 T8 Inscription 2020, 41 mil km, R$ 239.900. Curitiba.";

describe("parseManualForm", () => {
  it("accepts the pasted text with its origin, link and phone", () => {
    expect(
      parseManualForm({
        texto: `  ${TEXT}\r\n`,
        origem: "olx",
        link: "https://www.olx.com.br/anuncio/123",
        telefone: "(41) 99999-0000",
      }),
    ).toEqual({
      ok: true,
      input: {
        text: TEXT,
        channel: "olx",
        sourceUrl: "https://www.olx.com.br/anuncio/123",
        phone: "+5541999990000",
        force: false,
      },
    });
    expect(
      parseManualForm({ texto: TEXT, origem: "whatsapp", criar_mesmo_assim: "on" }),
    ).toMatchObject({ ok: true, input: { sourceUrl: null, phone: null, force: true } });
  });

  it("rejects a short text, an unknown origin, a bad link and a bad phone", () => {
    expect(
      parseManualForm({
        texto: "XC60",
        origem: "jornal",
        link: "javascript:alert(1)",
        telefone: "123",
      }),
    ).toEqual({
      ok: false,
      errors: {
        text: "Cole o texto do anúncio (pelo menos uma frase).",
        channel: "Diga de onde veio o anúncio.",
        sourceUrl: "Link inválido (comece com https://).",
        phone: "Telefone inválido: use o DDD.",
      },
    });
    expect(parseManualForm({ texto: "x".repeat(5001), origem: "olx" })).toMatchObject({
      ok: false,
      errors: { text: "Use no máximo 5.000 caracteres." },
    });
  });
});
