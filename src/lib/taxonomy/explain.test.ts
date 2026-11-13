import { describe, expect, it } from "vitest";

import {
  engineExplanation,
  engineFuelShort,
  modelExplanation,
  nameParts,
  trimExplanation,
  withVariantsLabel,
} from "./explain";

const XC60_T8_ULTIMATE_DARK = {
  modelId: "xc60",
  modelName: "XC60",
  engineId: "t8",
  engineName: "T8",
  trimId: "ultimate-dark",
  trimName: "Ultimate Dark",
  fuel: "hibrido_plugin" as const,
  yearModel: 2023,
};

describe("nameParts", () => {
  it("explains model, engine and trim from the taxonomy", () => {
    expect(nameParts(XC60_T8_ULTIMATE_DARK)).toEqual([
      { code: "XC60", role: "Modelo", text: "SUV · 2ª geração, desde 2018" },
      {
        code: "T8",
        role: "Motor",
        text: "Híbrido plug-in (motor a gasolina e motor elétrico, com bateria que carrega na tomada)",
      },
      {
        code: "Ultimate Dark",
        role: "Versão",
        text: "Variante do Ultimate. A versão define o pacote de equipamentos e o acabamento.",
      },
    ]);
  });

  it("is empty when the title is only the model", () => {
    expect(
      nameParts({ ...XC60_T8_ULTIMATE_DARK, engineId: null, engineName: null, trimId: null }),
    ).toEqual([]);
  });

  it("leaves out the parts the listing does not name", () => {
    const parts = nameParts({ ...XC60_T8_ULTIMATE_DARK, trimId: null, trimName: null });
    expect(parts.map((p) => p.role)).toEqual(["Modelo", "Motor"]);
  });
});

describe("engineExplanation", () => {
  it("narrows a multi-fuel engine to the listing's fuel", () => {
    expect(engineExplanation("t5", "gasolina")).toBe("Motor a gasolina");
    expect(engineExplanation("t5", null)).toBe(
      "Motor a gasolina ou híbrido plug-in, conforme o modelo e o ano",
    );
  });

  it("translates the electric motor names", () => {
    expect(engineExplanation("twin-motor", "eletrico")).toBe("100% elétrico, com dois motores");
    expect(engineFuelShort("single-motor")).toBe("elétrico, um motor");
  });

  it("gives the short fuel for engine links", () => {
    expect(engineFuelShort("t8")).toBe("híbrido plug-in");
    expect(engineFuelShort("t5")).toBe("gasolina ou híbrido plug-in");
    expect(engineFuelShort("nao-existe")).toBeNull();
  });
});

describe("modelExplanation and trimExplanation", () => {
  it("names the parent of a variant", () => {
    expect(modelExplanation("v40-cc", 2018)).toBe("Hatch · variante do V40");
  });

  it("uses the generation name when the model had several bodies", () => {
    expect(modelExplanation("v40", 2016)).toBe("2ª geração (hatch), 2013–2019");
  });

  it("defines what a versão is", () => {
    expect(trimExplanation("inscription")).toBe(
      "A versão define o pacote de equipamentos e o acabamento.",
    );
  });
});

describe("withVariantsLabel", () => {
  it("says which variants are included", () => {
    expect(withVariantsLabel("V40", ["V40 Cross Country"])).toBe("V40 (inclui Cross Country)");
    expect(withVariantsLabel("Ultimate", ["Ultimate Dark"])).toBe("Ultimate (inclui Dark)");
    expect(withVariantsLabel("XC60", [])).toBe("XC60");
  });
});
