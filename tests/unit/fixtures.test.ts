import { describe, expect, it } from "vitest";

import {
  getEngine,
  getModel,
  getTrim,
  isEngineCompatible,
  isEngineOfferedInBrazil,
  isTrimCompatible,
} from "@/lib/taxonomy";

import { FIXTURE_LISTINGS } from "../../scripts/db/fixtures";

const label = (l: (typeof FIXTURE_LISTINGS)[number]) =>
  `${l.model} ${l.engine ?? "-"} ${l.trim ?? "-"} ${l.yearModel}`;

describe("fictitious listings stay realistic for the Brazilian market", () => {
  it.each(FIXTURE_LISTINGS.map((l) => [label(l), l] as const))("%s", (_name, l) => {
    const years = { min: l.yearModel, max: l.yearModel };
    expect(getModel(l.model)?.brazil).not.toBe(false);
    if (l.engine) {
      expect(getEngine(l.engine)?.brazil).not.toBe(false);
      expect(isEngineCompatible(l.engine, l.model, years)).toBe(true);
      expect(isEngineOfferedInBrazil(l.engine, l.model, years)).toBe(true);
      expect(getEngine(l.engine)!.fuels).toContain(l.fuel);
    }
    if (l.trim) {
      expect(getTrim(l.trim)?.brazil).not.toBe(false);
      expect(isTrimCompatible(l.trim, l.model, years, l.engine ? [l.engine] : [])).toBe(true);
    }
  });
});
