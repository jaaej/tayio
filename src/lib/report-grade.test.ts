import { describe, expect, it } from "vitest";
import { letterFor, average, combineGrade } from "./report-grade";

describe("letterFor", () => {
  it("maps the band boundaries", () => {
    expect(letterFor(100)).toBe("A");
    expect(letterFor(90)).toBe("A");
    expect(letterFor(89.9)).toBe("B");
    expect(letterFor(80)).toBe("B");
    expect(letterFor(79)).toBe("C");
    expect(letterFor(70)).toBe("C");
    expect(letterFor(69)).toBe("D");
    expect(letterFor(60)).toBe("D");
    expect(letterFor(59.9)).toBe("F");
    expect(letterFor(0)).toBe("F");
  });
});

describe("average", () => {
  it("returns null for an empty list", () => {
    expect(average([])).toBeNull();
  });
  it("averages percentages", () => {
    expect(average([50, 100])).toBe(75);
    expect(average([90])).toBe(90);
  });
});

describe("combineGrade", () => {
  it("returns null when neither component has data", () => {
    expect(combineGrade(null, null)).toBeNull();
  });

  it("uses the single available component when the other is missing", () => {
    expect(combineGrade(84, null)).toMatchObject({ percent: 84, letter: "B" });
    expect(combineGrade(null, 72)).toMatchObject({ percent: 72, letter: "C" });
  });

  it("weights quiz and test equally when both exist", () => {
    // (60 + 100) / 2 = 80 -> B
    expect(combineGrade(60, 100)).toMatchObject({
      percent: 80,
      letter: "B",
      quizPercent: 60,
      testPercent: 100,
    });
  });

  it("rounds the combined percent to one decimal", () => {
    // (91 + 80) / 2 = 85.5
    expect(combineGrade(91, 80)?.percent).toBe(85.5);
    // (70 + 75) / 2 = 72.5 -> C
    expect(combineGrade(70, 75)).toMatchObject({ percent: 72.5, letter: "C" });
  });

  it("grades an A only at 90+ combined", () => {
    expect(combineGrade(88, 92)?.letter).toBe("A"); // 90 -> A
    expect(combineGrade(88, 91)?.letter).toBe("B"); // 89.5 -> B
  });
});
