import { describe, it, expect } from "vitest";
import { compareStanding, formatYear, rankOf, roundOutcome, type StandingRow } from "./standing";

const row = (studentId: string, best: number, firstAt: string): StandingRow => ({
  studentId,
  best,
  firstAt: new Date(firstAt),
});

describe("compareStanding / rankOf", () => {
  it("ranks by best score, highest first", () => {
    const rows = [row("a", 10, "2026-01-01"), row("b", 30, "2026-01-02"), row("c", 20, "2026-01-03")];
    expect([...rows].sort(compareStanding).map((r) => r.studentId)).toEqual(["b", "c", "a"]);
    expect(rankOf(rows, "a")).toBe(3);
  });

  it("breaks ties by who played the level first, then by id", () => {
    const rows = [row("z", 20, "2026-02-01"), row("y", 20, "2026-01-01"), row("x", 20, "2026-02-01")];
    expect([...rows].sort(compareStanding).map((r) => r.studentId)).toEqual(["y", "x", "z"]);
  });

  it("returns null for a player with no score and does not mutate the input", () => {
    const rows = [row("b", 5, "2026-01-02"), row("a", 9, "2026-01-01")];
    expect(rankOf(rows, "nobody")).toBeNull();
    expect(rows[0].studentId).toBe("b");
  });
});

describe("roundOutcome", () => {
  it("marks a beaten best as a record and reports what it beat", () => {
    expect(roundOutcome(31, 29, null)).toEqual({ isRecord: true, upFrom: 29, newRank: null });
  });

  it("treats a first scoring run as a record with nothing to be up from", () => {
    expect(roundOutcome(12, 0, null)).toEqual({ isRecord: true, upFrom: null, newRank: null });
  });

  it("is not a record when the score ties or misses the best, or is zero", () => {
    expect(roundOutcome(29, 29, null).isRecord).toBe(false);
    expect(roundOutcome(20, 29, null).isRecord).toBe(false);
    expect(roundOutcome(0, 0, null).isRecord).toBe(false);
  });

  it("reports a rank only when the player moved up or joined the board", () => {
    const base = { scope: "year" as const, yearLevel: "9" };
    expect(roundOutcome(31, 29, { ...base, before: 5, after: 3 }).newRank).toBe(3);
    expect(roundOutcome(12, 0, { ...base, before: null, after: 8 }).newRank).toBe(8);
    expect(roundOutcome(31, 30, { ...base, before: 3, after: 3 }).newRank).toBeNull();
  });
});

describe("formatYear", () => {
  it("labels a bare year and keeps a labelled one", () => {
    expect(formatYear("9")).toBe("Year 9");
    expect(formatYear("Year 10")).toBe("Year 10");
    expect(formatYear(null)).toBe("My year");
  });
});
