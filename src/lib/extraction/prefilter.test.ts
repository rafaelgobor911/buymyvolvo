import { describe, expect, it } from "vitest";

import { EVAL_CASES } from "../../../evals/extraction/dataset";

import { prefilter } from "./prefilter";

describe("prefilter on the gold dataset", () => {
  it.each(EVAL_CASES.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(prefilter(c.caption).pass).toBe(c.expected.prefilter);
  });
});

describe("prefilter reasons", () => {
  it.each([
    ["Que fim de tarde com a nossa V40! 🌅", "no_sale_signal"],
    ["Vendo Honda Civic 2018 R$ 80.000", "not_volvo"],
    ["Procuro XC60 até 200 mil", "wanted_ad"],
    ["VENDIDO! XC90 entregue", "sold"],
    ["2019 Volvo XC60 for sale $38,500, DM", "not_brazil"],
    ["Vendo meu Volvo XC60 2015, R$ 90.000", "ok"],
  ])("%s → %s", (caption, reason) => {
    expect(prefilter(caption).reason).toBe(reason);
  });

  it("does not take numbers like 850 for a model unless Volvo is mentioned", () => {
    expect(prefilter("Vendo moto 850cc, 12.000 km, R$ 30.000").reason).toBe("not_volvo");
    expect(prefilter("Volvo 850 GLT 1996, R$ 25.000").reason).toBe("ok");
  });
});
