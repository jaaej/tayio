import { describe, it, expect } from "vitest";
import { isPlausibleScore } from "./scoring";

describe("isPlausibleScore", () => {
  it("accepts scores within a tier's cap", () => {
    expect(isPlausibleScore("easy", 0)).toBe(true);
    expect(isPlausibleScore("easy", 150)).toBe(true);
    expect(isPlausibleScore("genius", 80)).toBe(true);
  });

  it("rejects scores above the cap", () => {
    expect(isPlausibleScore("easy", 151)).toBe(false);
    expect(isPlausibleScore("genius", 81)).toBe(false);
  });

  it("rejects negative and non-integer scores", () => {
    expect(isPlausibleScore("hard", -1)).toBe(false);
    expect(isPlausibleScore("hard", 3.5)).toBe(false);
  });
});
