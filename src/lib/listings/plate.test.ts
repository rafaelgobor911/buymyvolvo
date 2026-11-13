import { describe, expect, it } from "vitest";

import { plateText } from "./plate";

describe("plateText", () => {
  it("names the body type and the generation of the model year", () => {
    expect(plateText("xc60", "XC60", 2023)).toEqual({ name: "XC60", details: "SUV · 2ª geração" });
    expect(plateText("xc60", "XC60", 2012)).toEqual({ name: "XC60", details: "SUV · 1ª geração" });
  });

  it("leaves the generation out when the year is unknown", () => {
    expect(plateText("xc60", "XC60", null)).toEqual({ name: "XC60", details: "SUV" });
  });

  it("shows the base model large and the variant in the spec line", () => {
    expect(plateText("v40-cc", "V40 Cross Country", 2018)).toEqual({
      name: "V40",
      details: "Cross Country · Hatch",
    });
  });

  it("lets the generation name the body when the model had several", () => {
    expect(plateText("v40", "V40", 2016)).toEqual({ name: "V40", details: "2ª geração (hatch)" });
  });

  it("falls back to the given name for unknown models", () => {
    expect(plateText("nao-existe", "Volvo", 2020)).toEqual({ name: "Volvo", details: "" });
  });
});
