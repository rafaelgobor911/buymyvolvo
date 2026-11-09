import { describe, expect, it } from "vitest";

import {
  isIndexable,
  landingCounts,
  landingIntro,
  landingPath,
  resolveLanding,
} from "@/lib/seo/landing";

const page = (segments: string[]) => {
  const r = resolveLanding(segments);
  if (r.kind !== "page") throw new Error(`expected a page for ${segments.join("/")}: ${r.kind}`);
  return r.landing;
};

describe("resolveLanding", () => {
  it("model, version (engine or trim), state and version + state", () => {
    expect(page(["xc60"])).toMatchObject({
      path: "/volvo/xc60",
      depth: 1,
      name: "Volvo XC60",
      where: "",
      searchParams: { modelo: "xc60" },
    });
    expect(page(["xc60", "t8"])).toMatchObject({
      path: "/volvo/xc60/t8",
      depth: 2,
      name: "Volvo XC60 T8",
      searchParams: { modelo: "xc60", motor: "t8" },
    });
    expect(page(["xc60", "inscription"]).searchParams).toEqual({
      modelo: "xc60",
      versao: "inscription",
    });
    expect(page(["xc60", "sp"])).toMatchObject({
      path: "/volvo/xc60/sp",
      depth: 2,
      where: "em São Paulo",
      searchParams: { modelo: "xc60", uf: "SP" },
    });
    expect(page(["v40", "r-design", "rj"])).toMatchObject({
      path: "/volvo/v40/r-design/rj",
      depth: 3,
      name: "Volvo V40 R-Design",
      where: "no Rio de Janeiro",
      searchParams: { modelo: "v40", versao: "r-design", uf: "RJ" },
    });
  });

  it("redirects uppercase and encoded forms to the canonical path", () => {
    expect(resolveLanding(["XC60", "T8"])).toEqual({ kind: "redirect", path: "/volvo/xc60/t8" });
    expect(resolveLanding(["xc60", "SP"])).toEqual({ kind: "redirect", path: "/volvo/xc60/sp" });
  });

  it("404 for unknown, incompatible or misordered segments", () => {
    for (const segments of [
      [],
      ["xc61"],
      ["xc60", "xc90"],
      ["xc60", "t5r"], // T-5R only on the 850
      ["xc60", "sp", "t8"],
      ["xc60", "t8", "zz"],
      ["xc60", "t8", "sp", "extra"],
      ["%E0%A4%A"],
    ]) {
      expect(resolveLanding(segments).kind, segments.join("/")).toBe("not_found");
    }
  });

  it("builds paths from keys", () => {
    expect(landingPath({ modelId: "xc90", engineId: "t8", uf: "SP" })).toBe("/volvo/xc90/t8/sp");
    expect(landingPath({ modelId: "xc90", trimId: "ultimate" })).toBe("/volvo/xc90/ultimate");
  });
});

describe("landingCounts", () => {
  it("counts each combination, variants also for their parent", () => {
    const counts = landingCounts([
      { modelId: "xc60", engineId: "t8", trimId: "ultimate-dark", uf: "SP", count: 2 },
      { modelId: "xc60", engineId: "b5", trimId: null, uf: "PR", count: 1 },
      { modelId: "v40-cc", engineId: "t4", trimId: null, uf: null, count: 3 },
    ]);
    const get = (path: string) => counts.get(path)?.count;
    expect(get("/volvo/xc60")).toBe(3);
    expect(get("/volvo/xc60/t8")).toBe(2);
    expect(get("/volvo/xc60/ultimate-dark")).toBe(2);
    expect(get("/volvo/xc60/ultimate")).toBe(2);
    expect(get("/volvo/xc60/sp")).toBe(2);
    expect(get("/volvo/xc60/t8/sp")).toBe(2);
    expect(get("/volvo/xc60/ultimate/sp")).toBe(2);
    expect(get("/volvo/xc60/pr")).toBe(1);
    expect(get("/volvo/v40-cc")).toBe(3);
    expect(get("/volvo/v40")).toBe(3);
    expect(get("/volvo/v40/t4")).toBe(3);
  });

  it("indexes models with 1 listing and deeper pages with 2", () => {
    expect(isIndexable({ depth: 1, count: 1 })).toBe(true);
    expect(isIndexable({ depth: 2, count: 1 })).toBe(false);
    expect(isIndexable({ depth: 3, count: 2 })).toBe(true);
  });
});

describe("landingIntro", () => {
  it("states Brazilian model years and generations from the taxonomy", () => {
    const { paragraphs } = landingIntro(page(["xc60"]));
    expect(paragraphs[0]).toBe(
      "O XC60 (SUV) é vendido no Brasil desde o ano-modelo 2009. Gerações: 1ª geração (2009–2017) e 2ª geração (desde 2018).",
    );
  });

  it("links renamed models and parents", () => {
    const xc40 = landingIntro(page(["xc40"]));
    expect(xc40.paragraphs).toContain("A partir de 2024, o XC40 elétrico passou a se chamar EX40.");
    expect(xc40.related).toContainEqual({ path: "/volvo/ex40", label: "Ver EX40" });
    const cc = landingIntro(page(["v40-cc", "sp"]));
    expect(cc.related[0]).toEqual({ path: "/volvo/v40-cc", label: "Todos os V40 Cross Country" });
    expect(cc.related).toContainEqual({ path: "/volvo/v40", label: "Todos os V40" });
  });

  it("says when a model was never sold in Brazil", () => {
    expect(landingIntro(page(["v90"])).paragraphs[0]).toMatch(
      /não foi vendido oficialmente no Brasil/,
    );
  });
});
