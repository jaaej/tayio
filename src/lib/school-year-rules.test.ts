import { describe, expect, it } from "vitest";
import { finalYearStudents, moveSummary, planRollover, schoolYearToEnd } from "./school-year-rules";

const T = (year: number, termNumber: number, startDate: string, endDate: string) => ({
  year,
  termNumber,
  startDate,
  endDate,
});
const TERMS_2026 = [
  T(2026, 1, "2026-01-27", "2026-04-02"),
  T(2026, 2, "2026-04-20", "2026-06-26"),
  T(2026, 3, "2026-07-13", "2026-09-18"),
  T(2026, 4, "2026-10-12", "2026-11-22"),
];

describe("schoolYearToEnd", () => {
  it("is nothing before the final term starts", () => {
    expect(schoolYearToEnd(TERMS_2026, "2026-08-01")).toBeNull();
    expect(schoolYearToEnd(TERMS_2026, "2026-10-11")).toBeNull();
  });

  it("offers the year from the start of Term 4, the move once it has ended", () => {
    expect(schoolYearToEnd(TERMS_2026, "2026-10-12")).toMatchObject({ year: 2026, termEnded: false });
    expect(schoolYearToEnd(TERMS_2026, "2026-11-22")).toMatchObject({ year: 2026, termEnded: false });
    expect(schoolYearToEnd(TERMS_2026, "2026-11-23")).toMatchObject({ year: 2026, termEnded: true });
  });

  it("keeps offering the year over the summer holidays", () => {
    const next = [...TERMS_2026, T(2027, 1, "2027-01-28", "2027-04-01")];
    expect(schoolYearToEnd(next, "2027-01-10")).toMatchObject({ year: 2026, termEnded: true });
  });

  it("moves on once next year's first term starts", () => {
    const next = [...TERMS_2026, T(2027, 1, "2027-01-28", "2027-04-01")];
    expect(schoolYearToEnd(next, "2027-01-28")).toBeNull();
  });

  it("waits while a year's later terms are not set yet", () => {
    expect(schoolYearToEnd(TERMS_2026.slice(0, 2), "2026-05-01")).toBeNull();
  });

  it("is nothing with no terms", () => {
    expect(schoolYearToEnd([], "2026-11-23")).toBeNull();
  });
});

describe("planRollover", () => {
  const s = (id: string, yearLevel: string | null) => ({ id, name: id, yearLevel });

  it("moves each student up a year, finishes Year 12 and leaves the unreadable", () => {
    const plan = planRollover([
      s("prep", "Prep"),
      s("y7", "Year 7"),
      s("bare", "10"),
      s("y12", "Year 12"),
      s("vce", "VCE"),
      s("none", null),
    ]);
    expect(plan.moves).toEqual([
      { id: "prep", from: "Prep", to: "Year 1" },
      { id: "y7", from: "Year 7", to: "Year 8" },
      { id: "bare", from: "Year 10", to: "Year 11" },
    ]);
    expect(plan.finishing.map((x) => x.id)).toEqual(["y12"]);
    expect(plan.unknown.map((x) => x.id)).toEqual(["vce", "none"]);
  });

  it("summarises the moves in school order", () => {
    const plan = planRollover([s("a", "Year 9"), s("b", "Year 7"), s("c", "Year 9")]);
    expect(moveSummary(plan.moves)).toEqual([
      { from: "Year 7", to: "Year 8", count: 1 },
      { from: "Year 9", to: "Year 10", count: 2 },
    ]);
  });
});

describe("finalYearStudents", () => {
  it("takes Year 12 only, however it was typed", () => {
    const people = [
      { id: "a", yearLevel: "Year 12" },
      { id: "b", yearLevel: "12" },
      { id: "c", yearLevel: "VCE" },
      { id: "d", yearLevel: "Year 11" },
    ];
    expect(finalYearStudents(people).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
