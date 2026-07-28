import { describe, it, expect } from "vitest";
import {
  ratePct,
  avgScore,
  toClassReportRow,
  rollupOrgWide,
  type ClassMetricRow,
} from "./reports-metrics";

function row(over: Partial<ClassMetricRow> = {}): ClassMetricRow {
  return {
    classId: "c",
    className: "Class",
    tutorName: "Tutor",
    attended: 0,
    markedLessons: 0,
    homeworkCompleted: 0,
    homeworkAssigned: 0,
    enrolled: 0,
    capacity: 0,
    testScoreSum: 0,
    testScoreCount: 0,
    ...over,
  };
}

describe("ratePct", () => {
  it("rounds to an integer percentage", () => {
    expect(ratePct(1, 3)).toBe(33);
    expect(ratePct(2, 3)).toBe(67);
  });
  it("returns null when the denominator is zero", () => {
    expect(ratePct(0, 0)).toBeNull();
    expect(ratePct(5, 0)).toBeNull();
  });
});

describe("avgScore", () => {
  it("averages to one decimal place", () => {
    expect(avgScore(230, 3)).toBe(76.7);
  });
  it("returns null when count is zero", () => {
    expect(avgScore(0, 0)).toBeNull();
  });
});

describe("toClassReportRow", () => {
  it("maps counts to rates and passes through fill counts", () => {
    const r = toClassReportRow(
      row({
        attended: 8,
        markedLessons: 10,
        homeworkCompleted: 3,
        homeworkAssigned: 4,
        enrolled: 6,
        capacity: 8,
        testScoreSum: 150,
        testScoreCount: 2,
      }),
    );
    expect(r.attendancePct).toBe(80);
    expect(r.homeworkPct).toBe(75);
    expect(r.avgTestResult).toBe(75);
    expect(r.enrolled).toBe(6);
    expect(r.capacity).toBe(8);
  });
  it("uses null for empty denominators", () => {
    const r = toClassReportRow(row());
    expect(r.attendancePct).toBeNull();
    expect(r.homeworkPct).toBeNull();
    expect(r.avgTestResult).toBeNull();
  });
});

describe("rollupOrgWide", () => {
  it("weights by totals, not by averaging per-class rates", () => {
    // Class A: 1/1 attended (100%). Class B: 1/9 attended (11%).
    // Average-of-rates would be ~56%; weighted is 2/10 = 20%.
    const out = rollupOrgWide([
      row({ attended: 1, markedLessons: 1, enrolled: 1, capacity: 1 }),
      row({ attended: 1, markedLessons: 9, enrolled: 9, capacity: 10 }),
    ]);
    expect(out.attendancePct).toBe(20);
    expect(out.fillPct).toBe(91); // 10/11
  });
  it("returns nulls when there is nothing to roll up", () => {
    expect(rollupOrgWide([])).toEqual({
      attendancePct: null,
      homeworkPct: null,
      fillPct: null,
    });
  });
});
