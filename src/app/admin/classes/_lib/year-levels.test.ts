import { describe, expect, it } from "vitest";
import { YEAR_LEVELS, yearLevelOptions } from "./year-levels";

describe("yearLevelOptions", () => {
  it("offers the standard levels", () => {
    expect(yearLevelOptions(null)).toEqual(YEAR_LEVELS);
    expect(yearLevelOptions("Year 9")).toEqual(YEAR_LEVELS);
  });

  it("keeps a saved level that is not in the list", () => {
    expect(yearLevelOptions("Selective").at(-1)).toBe("Selective");
  });
});
