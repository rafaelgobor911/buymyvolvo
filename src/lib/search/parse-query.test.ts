import { describe, expect, it } from "vitest";

import { parseBrazilianNumber, parseQuery } from "./parse-query";

const NOW = new Date("2026-11-07T12:00:00-03:00");
const parse = (q: string) => parseQuery(q, { now: NOW });

describe("parseQuery: acceptance table (PROMPT.md §5)", () => {
  it("s60 t5 → S60 + T5 only", () => {
    const r = parse("s60 t5");
    expect(r.modelIds).toEqual(["s60", "s60-cc"]);
    expect(r.engineIds).toEqual(["t5"]);
    expect(r.trimIds).toEqual([]);
    expect(r.text).toBe("");
  });

  it("S60T5 2019 → S60, T5, year 2019", () => {
    const r = parse("S60T5 2019");
    expect(r.modelIds).toContain("s60");
    expect(r.engineIds).toEqual(["t5"]);
    expect([r.yearMin, r.yearMax]).toEqual([2019, 2019]);
    expect(r.text).toBe("");
  });

  it("xc60 t8 polestar → Polestar Engineered", () => {
    const r = parse("xc60 t8 polestar");
    expect(r.modelIds).toEqual(["xc60"]);
    expect(r.engineIds).toEqual(["t8"]);
    expect(r.trimIds).toEqual(["polestar-engineered"]);
  });

  it("xc40 elétrico até 200 mil → XC40/EX40, electric, ≤ 200k", () => {
    const r = parse("xc40 elétrico até 200 mil");
    expect(r.modelIds.sort()).toEqual(["ex40", "xc40"]);
    expect(r.fuels).toEqual(["eletrico"]);
    expect(r.priceMax).toBe(200_000);
    expect(r.text).toBe("");
  });

  it("v40 r-design sp → V40 (incl. Cross Country), R-Design, SP", () => {
    const r = parse("v40 r-design sp");
    expect(r.modelIds).toEqual(["v40", "v40-cc"]);
    expect(r.trimIds).toEqual(["r-design"]);
    expect(r.uf).toBe("SP");
  });

  it("xc90 t8 2020 a 2022 até 60 mil km → year range and km", () => {
    const r = parse("xc90 t8 2020 a 2022 até 60 mil km");
    expect(r.modelIds).toEqual(["xc90"]);
    expect(r.engineIds).toEqual(["t8"]);
    expect([r.yearMin, r.yearMax]).toEqual([2020, 2022]);
    expect(r.kmMax).toBe(60_000);
    expect(r.priceMax).toBeUndefined();
  });

  it("850 t5r → 850 T-5R", () => {
    const r = parse("850 t5r");
    expect(r.modelIds).toEqual(["850"]);
    expect(r.engineIds).toEqual(["t5r"]);
    expect(r.priceMax).toBeUndefined();
  });

  it("c30 t5 manual → C30, T5, manual", () => {
    const r = parse("c30 t5 manual");
    expect(r.modelIds).toEqual(["c30"]);
    expect(r.engineIds).toEqual(["t5"]);
    expect(r.transmission).toBe("manual");
  });

  it("volvo de loja em curitiba → dealer in Curitiba", () => {
    const r = parse("volvo de loja em curitiba");
    expect(r.sellerType).toBe("loja");
    expect(r.city).toBe("Curitiba");
    expect(r.uf).toBe("PR");
    expect(r.modelIds).toEqual([]);
    expect(r.text).toBe("");
  });

  it("xc60 t8 sp até 250 mil → every filter applied", () => {
    const r = parse("xc60 t8 sp até 250 mil");
    expect(r).toMatchObject({ modelIds: ["xc60"], engineIds: ["t8"], uf: "SP", priceMax: 250_000 });
  });
});

describe("parseQuery: spelling variants", () => {
  it.each([
    ["s-60 t5", "s60"],
    ["s 60 t5", "s60"],
    ["xc 60", "xc60"],
    ["XC60", "xc60"],
  ])("%s → %s", (q, model) => {
    expect(parse(q).modelIds).toContain(model);
  });

  it("splits glued model+engine tokens", () => {
    const r = parse("xc60t8");
    expect(r.modelIds).toEqual(["xc60"]);
    expect(r.engineIds).toEqual(["t8"]);
  });

  it.each(["r design", "rdesign", "r-desing", "R-Design"])("understands %s", (q) => {
    expect(parse(`v40 ${q}`).trimIds).toEqual(["r-design"]);
  });

  it("does not read 't5 r design' as T-5R", () => {
    const r = parse("s60 t5 r design");
    expect(r.engineIds).toEqual(["t5"]);
    expect(r.trimIds).toEqual(["r-design"]);
  });

  it("t8 polestar without model keeps only Polestar Engineered (T8)", () => {
    expect(parse("t8 polestar").trimIds).toEqual(["polestar-engineered"]);
  });

  it("s60 polestar keeps both Polestar trims", () => {
    expect(parse("s60 polestar").trimIds.sort()).toEqual(["polestar", "polestar-engineered"]);
  });

  it.each([
    ["eletrico", ["eletrico"]],
    ["100% elétrico", ["eletrico"]],
    ["recharge", ["hibrido_plugin", "eletrico"]],
    ["híbrido plug-in", ["hibrido_plugin"]],
    ["phev", ["hibrido_plugin"]],
    ["mild hybrid", ["hibrido_leve"]],
    ["diesel", ["diesel"]],
  ])("fuel: %s", (q, fuels) => {
    expect(parse(q).fuels).toEqual(fuels);
  });
});

describe("parseQuery: model families", () => {
  it("v40 includes the V40 Cross Country", () => {
    expect(parse("v40").modelIds).toEqual(["v40", "v40-cc"]);
  });

  it.each(["v40 cross country", "v40 cc", "V40 Cross Country T5"])(
    "%s → only the Cross Country",
    (q) => {
      expect(parse(q).modelIds).toEqual(["v40-cc"]);
    },
  );

  it("c40 and ec40 are the same car", () => {
    expect(parse("c40").modelIds.sort()).toEqual(["c40", "ec40"]);
    expect(parse("ec40").modelIds.sort()).toEqual(["c40", "ec40"]);
  });

  it("ex40 also finds electric XC40s", () => {
    const r = parse("ex40");
    expect(r.modelIds.sort()).toEqual(["ex40", "xc40"]);
    expect(r.fuels).toEqual(["eletrico"]);
  });

  it("plain xc40 does not drag in the EX40", () => {
    expect(parse("xc40").modelIds).toEqual(["xc40"]);
  });

  it("several models at once", () => {
    expect(parse("xc60 ou xc90").modelIds).toEqual(["xc60", "xc90"]);
  });
});

describe("parseQuery: numbers", () => {
  it.each([
    ["até 189k", 189_000],
    ["ate R$ 189.900,00", 189_900],
    ["R$189.900", 189_900],
    ["150 mil", 150_000],
    ["abaixo de 1,2 milhão", 1_200_000],
    ["por até 95000", 95_000],
  ])("price max: %s", (q, value) => {
    expect(parse(q).priceMax).toBe(value);
  });

  it("price range", () => {
    expect(parse("de 100 a 150 mil")).toMatchObject({ priceMin: 100_000, priceMax: 150_000 });
    expect(parse("acima de 300 mil").priceMin).toBe(300_000);
  });

  it.each([
    ["58mil km", 58_000],
    ["58.000 km", 58_000],
    ["até 60k km", 60_000],
    ["km até 80 mil", 80_000],
    ["com menos de 30 mil km", 30_000],
  ])("km max: %s", (q, value) => {
    const r = parse(q);
    expect(r.kmMax).toBe(value);
    expect(r.priceMax).toBeUndefined();
  });

  it.each([
    ["19/20", 2020, 2020],
    ["2019/2020", 2020, 2020],
    ["2018-2020", 2018, 2020],
    ["de 2015 a 2017", 2015, 2017],
    ["a partir de 2018", 2018, undefined],
    ["2018+", 2018, undefined],
    ["até 2015", undefined, 2015],
  ])("years: %s", (q, min, max) => {
    const r = parse(q);
    expect([r.yearMin, r.yearMax]).toEqual([min, max]);
    expect(r.priceMax).toBeUndefined();
  });

  it("ignores impossible years", () => {
    expect(parse("2035").yearMin).toBeUndefined();
  });

  it("parses Brazilian number formats", () => {
    expect(parseBrazilianNumber("189.900,00")).toBe(189_900);
    expect(parseBrazilianNumber("58.000")).toBe(58_000);
    expect(parseBrazilianNumber("1,5")).toBe(1.5);
  });
});

describe("parseQuery: places", () => {
  it("são paulo means the state, with the city offered as a narrower option", () => {
    const r = parse("xc60 são paulo");
    expect(r.uf).toBe("SP");
    expect(r.city).toBeUndefined();
    expect(r.citySuggestion).toEqual({ city: "São Paulo", uf: "SP" });
  });

  it.each(["cidade de são paulo", "sampa", "sp capital", "capital paulista"])(
    "%s means the city of São Paulo",
    (q) => {
      expect(parse(q)).toMatchObject({ city: "São Paulo", uf: "SP" });
    },
  );

  it("rio de janeiro works as state and as city", () => {
    expect(parse("v40 rio de janeiro")).toMatchObject({
      uf: "RJ",
      citySuggestion: { city: "Rio de Janeiro" },
    });
    expect(parse("cidade do rio de janeiro")).toMatchObject({ city: "Rio de Janeiro", uf: "RJ" });
  });

  it("estado de são paulo is the state", () => {
    const r = parse("estado de são paulo");
    expect(r.uf).toBe("SP");
    expect(r.city).toBeUndefined();
  });

  it.each([
    ["porto alegre", "Porto Alegre", "RS"],
    ["floripa", "Florianópolis", "SC"],
    ["são josé dos campos", "São José dos Campos", "SP"],
    ["bh", "Belo Horizonte", "MG"],
  ])("city %s", (q, city, uf) => {
    expect(parse(q)).toMatchObject({ city, uf });
  });

  it.each([
    ["santa catarina", "SC"],
    ["minas gerais", "MG"],
    ["rio grande do sul", "RS"],
    ["paraná", "PR"],
  ])("state %s", (q, uf) => {
    expect(parse(q).uf).toBe(uf);
  });

  it("ambiguous UF codes need context or uppercase", () => {
    expect(parse("xc60 se possível preto").uf).toBeUndefined();
    expect(parse("xc60 SE").uf).toBe("SE");
    expect(parse("xc60 em pe").uf).toBe("PE");
  });
});

describe("parseQuery: leftovers and warnings", () => {
  it("sends unknown words to full-text", () => {
    const r = parse("xc90 t8 teto solar preto");
    expect(r.modelIds).toEqual(["xc90"]);
    expect(r.text).toBe("teto solar preto");
  });

  it("warns about impossible combinations", () => {
    expect(parse("v40 t8").warnings[0]).toMatch(/V40.*T8/);
  });

  it("handles empty input", () => {
    expect(parse("   ")).toMatchObject({ modelIds: [], text: "" });
  });

  it("particular vs loja", () => {
    expect(parse("xc60 particular").sellerType).toBe("particular");
    expect(parse("direto com o dono").sellerType).toBe("particular");
    expect(parse("concessionária").sellerType).toBe("loja");
  });
});
