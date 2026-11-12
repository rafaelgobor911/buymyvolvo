import { describe, expect, it } from "vitest";

import {
  DEFAULT_INVITE_TEMPLATE,
  formatCommission,
  inviteTemplateProblem,
  nextBmvNumber,
  parseBmvNumbers,
  readBmvNumbers,
  renderInvite,
} from "./messages";

describe("invite message", () => {
  it("fills the car and the link", () => {
    expect(
      renderInvite(DEFAULT_INVITE_TEMPLATE, {
        modelo: "XC60",
        versao: "T8 Inscription",
        ano: 2020,
        site: "Buy My Volvo",
        link: "https://buymyvolvo.com.br/autorizar/abc.def",
      }),
    ).toBe(
      "Olá! Aqui é do Buy My Volvo, um site que reúne anúncios de Volvo seminovos. Vimos o seu Volvo XC60 T8 Inscription 2020 e gostaríamos de divulgá-lo e levar compradores até você. Veja as condições e autorize por este link: https://buymyvolvo.com.br/autorizar/abc.def",
    );
    expect(
      renderInvite("Seu {modelo} {versao}: {link}", { modelo: "XC40", site: "S", link: "L" }),
    ).toBe("Seu XC40: L");
  });

  it("requires the link and refuses the buyer's reference code", () => {
    expect(inviteTemplateProblem(DEFAULT_INVITE_TEMPLATE)).toBeNull();
    expect(inviteTemplateProblem("Olá, autorize o seu {modelo}")).toMatch(/\{link\}/);
    expect(inviteTemplateProblem("Olá {nome}: {link}")).toBe("Variável desconhecida: {nome}.");
    expect(inviteTemplateProblem("Código {ref}: {link}")).toMatch(/tire \{ref\}/);
    expect(inviteTemplateProblem("")).toMatch(/vazia/);
  });
});

describe("Buy My Volvo numbers", () => {
  it("parses one or several Brazilian numbers, as typed", () => {
    expect(parseBmvNumbers("(11) 98765-4321")).toEqual({
      numbers: ["+5511987654321"],
      invalid: [],
    });
    expect(parseBmvNumbers("11 98765-4321, +55 41 99999-0000; 11987654321")).toEqual({
      numbers: ["+5511987654321", "+5541999990000"],
      invalid: [],
    });
    expect(parseBmvNumbers("(20) 90000-0000").invalid).toEqual(["(20) 90000-0000"]);
    expect(parseBmvNumbers("")).toEqual({ numbers: [], invalid: [] });
  });

  it("reads the saved setting, the seed's fictitious number included", () => {
    expect(readBmvNumbers("+5511987654321, +5520900000000")).toEqual([
      "+5511987654321",
      "+5520900000000",
    ]);
    expect(readBmvNumbers("")).toEqual([]);
    expect(readBmvNumbers(null)).toEqual([]);
    expect(readBmvNumbers(42)).toEqual([]);
  });

  it("alternates between the numbers (round-robin)", () => {
    const numbers = ["+5511900000001", "+5511900000002"];
    expect(nextBmvNumber(numbers, null)).toBe(numbers[0]);
    expect(nextBmvNumber(numbers, numbers[0]!)).toBe(numbers[1]);
    expect(nextBmvNumber(numbers, numbers[1]!)).toBe(numbers[0]);
    expect(nextBmvNumber(numbers, "+5511999999999")).toBe(numbers[0]);
    expect(nextBmvNumber(["+5511900000001"], "+5511900000001")).toBe("+5511900000001");
    expect(nextBmvNumber([], null)).toBeNull();
  });
});

describe("formatCommission", () => {
  it("shows reais, or nothing while the commission is not defined", () => {
    expect(formatCommission(150_000)?.replace(/\s/g, " ")).toBe("R$ 1.500");
    expect(formatCommission(99_950)?.replace(/\s/g, " ")).toBe("R$ 999,50");
    expect(formatCommission(0)).toBeNull();
    expect(formatCommission(null)).toBeNull();
  });
});
