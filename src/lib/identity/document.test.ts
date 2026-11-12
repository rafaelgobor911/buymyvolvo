import { describe, expect, it } from "vitest";

import { formatCnpj, formatCpf, parseCnpj, parseCpf } from "./document";

describe("parseCpf", () => {
  it("accepts valid CPFs with or without punctuation", () => {
    expect(parseCpf("529.982.247-25")).toBe("52998224725");
    expect(parseCpf("11144477735")).toBe("11144477735");
    expect(parseCpf(" 111.444.777-35 ")).toBe("11144477735");
  });

  it("refuses wrong check digits, repeated digits and other lengths", () => {
    expect(parseCpf("529.982.247-24")).toBeNull();
    expect(parseCpf("111.111.111-11")).toBeNull();
    expect(parseCpf("000.000.000-00")).toBeNull();
    expect(parseCpf("1234567890")).toBeNull();
    expect(parseCpf("")).toBeNull();
    expect(parseCpf(null)).toBeNull();
  });
});

describe("parseCnpj", () => {
  it("accepts numeric and alphanumeric CNPJs", () => {
    expect(parseCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(parseCnpj("12.ABC.345/01DE-35")).toBe("12ABC34501DE35");
    expect(parseCnpj("12abc34501de35")).toBe("12ABC34501DE35");
  });

  it("refuses wrong check digits and repeated digits", () => {
    expect(parseCnpj("11.222.333/0001-82")).toBeNull();
    expect(parseCnpj("12.ABC.345/01DE-36")).toBeNull();
    expect(parseCnpj("00.000.000/0000-00")).toBeNull();
    expect(parseCnpj("1122233300018")).toBeNull();
  });
});

describe("format", () => {
  it("adds the usual punctuation", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});
