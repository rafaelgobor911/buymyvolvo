import { describe, expect, it } from "vitest";

import { type DedupeCandidate, dedupeKey, isLikelySameCar } from "./dedupe";
import type { NormalizedListing } from "./normalize";

const car = (over: Partial<DedupeCandidate> = {}): DedupeCandidate => ({
  modelId: "xc60",
  yearModel: 2020,
  km: 41_000,
  contactPhone: "+5541900000101",
  contactIgUsername: null,
  text: "Vendo XC60 T8 Inscription 2020 com 41 mil km",
  ...over,
});

describe("isLikelySameCar", () => {
  it("same seller, model, year and close mileage", () => {
    expect(isLikelySameCar(car(), car({ km: 42_500, text: "outro texto qualquer" }))).toBe(true);
  });

  it("tells apart two cars of the same dealer by mileage", () => {
    expect(isLikelySameCar(car(), car({ km: 60_000 }))).toBe(false);
  });

  it("needs similar text when the mileage is unknown", () => {
    expect(
      isLikelySameCar(
        car({ km: null }),
        car({ text: "Vendo XC60 T8 Inscription 2020, 41 mil km" }),
      ),
    ).toBe(true);
    expect(isLikelySameCar(car({ km: null }), car({ text: "" }))).toBe(false);
  });

  it("never merges different sellers or models", () => {
    expect(isLikelySameCar(car(), car({ contactPhone: "+5541900000999" }))).toBe(false);
    expect(isLikelySameCar(car(), car({ modelId: "xc90" }))).toBe(false);
  });
});

describe("dedupeKey", () => {
  const n = {
    modelId: "xc60",
    engineId: "t8",
    yearModel: 2020,
    km: 41_000,
    contactPhone: "+5541900000101",
    contactIgUsername: null,
  } as NormalizedListing;

  it("is stable within the same 5,000 km bucket and needs a contact", () => {
    expect(dedupeKey(n)).toBe(dedupeKey({ ...n, km: 42_000 }));
    expect(dedupeKey(n)).not.toBe(dedupeKey({ ...n, km: 60_000 }));
    expect(dedupeKey({ ...n, contactPhone: null })).toBeNull();
  });
});
