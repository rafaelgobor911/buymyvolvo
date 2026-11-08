import { describe, expect, it } from "vitest";

import { reportDays } from "./leads-report";
import { normalizeHashtag } from "./sources";

describe("admin ops helpers", () => {
  it("normalizes hashtags", () => {
    expect(normalizeHashtag("#VolvoXC60")).toBe("volvoxc60");
    expect(normalizeHashtag("volvo xc60")).toBeNull();
    expect(normalizeHashtag("#a")).toBeNull();
  });

  it("only accepts the offered report periods", () => {
    expect(reportDays("7")).toBe(7);
    expect(reportDays("90")).toBe(90);
    expect(reportDays("3650")).toBe(30);
    expect(reportDays(undefined)).toBe(30);
  });
});
