import { describe, expect, it } from "vitest";
import {
  attainmentScore,
  attendanceStrip,
  bandFromPercentile,
  bandFromScore,
  bandLabel,
  percentileRank,
  rateCohort,
} from "./attainment-bands";

describe("bands", () => {
  it("names the six bands", () => {
    expect([1, 2, 3, 4, 5, 6].map((b) => bandLabel(b as 1))).toEqual([
      "Below average",
      "Low average",
      "Average",
      "High average",
      "Above average",
      "Proficient",
    ]);
  });

  it("splits percentiles the standard way", () => {
    expect(bandFromPercentile(99)).toBe(6);
    expect(bandFromPercentile(98)).toBe(6);
    expect(bandFromPercentile(95)).toBe(5);
    expect(bandFromPercentile(91)).toBe(5);
    expect(bandFromPercentile(90)).toBe(4);
    expect(bandFromPercentile(75)).toBe(4);
    expect(bandFromPercentile(50)).toBe(3);
    expect(bandFromPercentile(25)).toBe(3);
    expect(bandFromPercentile(24)).toBe(2);
    expect(bandFromPercentile(9)).toBe(2);
    expect(bandFromPercentile(8)).toBe(1);
  });

  it("bands a score directly for a small cohort", () => {
    expect([95, 85, 75, 65, 55, 45].map(bandFromScore)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(bandFromScore(90)).toBe(6);
    expect(bandFromScore(49.9)).toBe(1);
  });
});

describe("percentileRank", () => {
  it("counts those below plus half of those level", () => {
    expect(percentileRank(50, [10, 20, 50, 80])).toBe(62.5);
    expect(percentileRank(10, [10, 10, 10, 10])).toBe(50);
  });
});

describe("rateCohort", () => {
  it("curves a cohort of ten or more", () => {
    const scores = new Map(Array.from({ length: 50 }, (_, i) => [`s${i}`, i * 2] as [string, number]));
    const bands = rateCohort(scores);
    expect(bands.get("s49")).toBe(6); // the top score, 99th percentile
    expect(bands.get("s25")).toBe(3); // the middle
    expect(bands.get("s0")).toBe(1); // the bottom
  });

  it("gives everyone with the same score the same band", () => {
    const scores = new Map(Array.from({ length: 12 }, (_, i) => [`s${i}`, 70] as [string, number]));
    expect(new Set(rateCohort(scores).values())).toEqual(new Set([3]));
  });

  it("bands the score itself when fewer than ten are scored", () => {
    const bands = rateCohort(new Map([["a", 92], ["b", 61], ["c", 40]]));
    expect([bands.get("a"), bands.get("b"), bands.get("c")]).toEqual([6, 3, 1]);
  });
});

describe("attainmentScore", () => {
  it("counts each test and major quiz once", () => {
    expect(attainmentScore([80, 60], [100])).toBe(80);
    expect(attainmentScore([78, 91], [0])).toBeCloseTo(56.33, 2);
  });
  it("uses whichever kind there is", () => {
    expect(attainmentScore([70], [])).toBe(70);
    expect(attainmentScore([], [90, 70])).toBe(80);
    expect(attainmentScore([], [])).toBeNull();
  });
});

describe("attendanceStrip", () => {
  it("is green, red, grey and blank in date order", () => {
    const cells = attendanceStrip(
      [
        { date: "2026-10-24", status: null, cancelled: false },
        { date: "2026-10-10", status: "present", cancelled: false },
        { date: "2026-10-17", status: "absent", cancelled: false },
        { date: "2026-10-31", status: null, cancelled: true },
      ],
      [],
    );
    expect(cells.map((c) => c.state)).toEqual(["attended", "missed", "unmarked", "cancelled"]);
  });

  it("counts a missed lesson made up in the same week as made up", () => {
    const cells = attendanceStrip(
      [
        { date: "2026-10-17", status: "absent", cancelled: false },
        { date: "2026-10-24", status: "absent", cancelled: false },
      ],
      // Wednesday 14 October is the week of Saturday 17; Monday 26 is the next week.
      ["2026-10-14", "2026-10-26"],
    );
    expect(cells.map((c) => c.state)).toEqual(["made_up", "missed"]);
  });
});
