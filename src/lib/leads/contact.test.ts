import { describe, expect, it } from "vitest";

import {
  DEFAULT_MESSAGE_TEMPLATE,
  generateRefCode,
  instagramUrl,
  isFictitiousPhone,
  REF_CODE_PATTERN,
  renderMessage,
  whatsappUrl,
} from "./contact";

describe("generateRefCode", () => {
  it("matches the database constraint and avoids ambiguous characters", () => {
    const codes = Array.from({ length: 500 }, () => generateRefCode());
    for (const code of codes) {
      expect(code).toMatch(REF_CODE_PATTERN);
      expect(code).toMatch(/^VX-[2-9A-HJKMNP-Z]{5}$/);
    }
    expect(new Set(codes).size).toBeGreaterThan(495);
  });
});

describe("renderMessage", () => {
  const vars = {
    modelo: "XC60",
    versao: "T8 Polestar Engineered",
    ano: 2024,
    site: "Volvo Usados",
    url: "https://exemplo.com.br/a/4245s2",
    ref: "VX-7K3P9",
  };

  it("fills the default template", () => {
    expect(renderMessage(DEFAULT_MESSAGE_TEMPLATE, vars)).toBe(
      "Olá! Vi seu Volvo XC60 T8 Polestar Engineered 2024 anunciado no Volvo Usados (https://exemplo.com.br/a/4245s2). Ainda está disponível? (ref. VX-7K3P9)",
    );
  });

  it("leaves no gaps when the version or year is missing", () => {
    expect(renderMessage(DEFAULT_MESSAGE_TEMPLATE, { ...vars, versao: null, ano: null })).toBe(
      "Olá! Vi seu Volvo XC60 anunciado no Volvo Usados (https://exemplo.com.br/a/4245s2). Ainda está disponível? (ref. VX-7K3P9)",
    );
    expect(renderMessage("Volvo {modelo} ({ano}).", { ...vars, ano: null })).toBe("Volvo XC60.");
  });

  it("accepts the spec's spellings and keeps unknown placeholders visible", () => {
    expect(renderMessage("{Modelo} {versão} {NOME_DO_SITE} {url_curta} {REF}", vars)).toBe(
      "XC60 T8 Polestar Engineered Volvo Usados https://exemplo.com.br/a/4245s2 VX-7K3P9",
    );
    expect(renderMessage("Oi {nome}, ref {ref}", vars)).toBe("Oi {nome}, ref VX-7K3P9");
  });
});

describe("contact links", () => {
  it("builds the wa.me link with the encoded message", () => {
    expect(whatsappUrl("+5511987654321", "Olá! (ref. VX-ABCDE)")).toBe(
      "https://wa.me/5511987654321?text=Ol%C3%A1!%20(ref.%20VX-ABCDE)",
    );
    expect(() => whatsappUrl("+55", "x")).toThrow();
  });

  it("prefers the Instagram Direct and falls back to the post", () => {
    expect(
      instagramUrl({ username: "@loja.volvo", permalink: "https://www.instagram.com/p/X1/" }),
    ).toBe("https://ig.me/m/loja.volvo");
    expect(instagramUrl({ username: null, permalink: "https://www.instagram.com/p/X1/" })).toBe(
      "https://www.instagram.com/p/X1/",
    );
    expect(
      instagramUrl({ username: "nome com espaço", permalink: "https://evil.example/p" }),
    ).toBeNull();
  });

  it("recognizes the fictitious DDD 20", () => {
    expect(isFictitiousPhone("+5520910000017")).toBe(true);
    expect(isFictitiousPhone("+5511987654321")).toBe(false);
    expect(isFictitiousPhone(null)).toBe(false);
  });
});
