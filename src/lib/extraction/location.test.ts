import { describe, expect, it } from "vitest";

import { fillLocation, UF_BY_DDD, ufFromPhone } from "./location";
import { VALID_DDDS } from "./normalize";

describe("UF_BY_DDD", () => {
  it("covers exactly the area codes the phone validation accepts", () => {
    expect(Object.keys(UF_BY_DDD).map(Number).sort()).toEqual([...VALID_DDDS].sort());
  });

  it("reads the state of a Brazilian E.164 number", () => {
    expect(ufFromPhone("+5511999990000")).toBe("SP");
    expect(ufFromPhone("+557599894400")).toBe("BA");
    expect(ufFromPhone("+5561999990000")).toBe("DF");
    expect(ufFromPhone("+5520900000000")).toBeNull(); // DDD 20 does not exist (fictitious)
    expect(ufFromPhone("+14155550100")).toBeNull();
    expect(ufFromPhone(null)).toBeNull();
  });
});

describe("fillLocation", () => {
  const phone = "+5541990000001";

  it("keeps what the post says", () => {
    expect(fillLocation({ city: "Curitiba", uf: "PR" }, { sourceUf: "SP", phone })).toEqual({
      city: "Curitiba",
      uf: "PR",
      ufFromDdd: false,
    });
    expect(fillLocation({ city: null, uf: "SC" }, { sourceUf: "SP", phone }).uf).toBe("SC");
  });

  it("then the shop's default location", () => {
    expect(
      fillLocation({ city: null, uf: null }, { sourceCity: "Vinhedo", sourceUf: "SP", phone }),
    ).toEqual({ city: "Vinhedo", uf: "SP", ufFromDdd: false });
  });

  it("then only the state of the DDD, flagged", () => {
    expect(fillLocation({ city: null, uf: null }, { phone })).toEqual({
      city: null,
      uf: "PR",
      ufFromDdd: true,
    });
    expect(fillLocation({ city: null, uf: null }, { phone: null })).toEqual({
      city: null,
      uf: null,
      ufFromDdd: false,
    });
  });
});
