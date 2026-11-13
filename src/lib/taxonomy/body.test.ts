import { describe, expect, it } from "vitest";

import { bodyTypeMatches, getModel, primaryBodyType } from "./index";

describe("bodyTypeMatches", () => {
  it("lists whole models for a single-body model", () => {
    const suv = bodyTypeMatches("suv");
    expect(suv).toContainEqual({ modelId: "xc60" });
    expect(suv.some((m) => m.modelId === "s60")).toBe(false);
  });

  it("narrows a model sold with several bodies to its generations", () => {
    expect(bodyTypeMatches("perua").filter((m) => m.modelId === "v40")).toEqual([
      { modelId: "v40", yearMin: 1996, yearMax: 2004 },
    ]);
    expect(bodyTypeMatches("hatch").filter((m) => m.modelId === "v40")).toEqual([
      { modelId: "v40", yearMin: 2013, yearMax: 2019 },
    ]);
  });

  it("groups a model by the body of its latest generation", () => {
    expect(primaryBodyType(getModel("v40")!)).toBe("hatch");
    expect(primaryBodyType(getModel("xc90")!)).toBe("suv");
  });
});
