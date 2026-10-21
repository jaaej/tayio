import { describe, expect, it } from "vitest";
import { checkEntry, ratingLabel, reportWritingTerm } from "./term-report-entry-rules";

const T3 = { id: "t3", startDate: "2026-07-13", endDate: "2026-09-18" };
const T4 = { id: "t4", startDate: "2026-10-12", endDate: "2026-11-22" };

describe("reportWritingTerm", () => {
  it("opens three weeks before a term ends and closes four weeks after", () => {
    expect(reportWritingTerm([T4], "2026-10-31")).toBeNull();
    expect(reportWritingTerm([T4], "2026-11-01")).toBe(T4);
    expect(reportWritingTerm([T4], "2026-11-22")).toBe(T4);
    expect(reportWritingTerm([T4], "2026-12-20")).toBe(T4);
    expect(reportWritingTerm([T4], "2026-12-21")).toBeNull();
  });

  it("is closed mid-term", () => {
    expect(reportWritingTerm([T3, T4], "2026-08-01")).toBeNull();
  });

  it("takes the later term when two windows meet", () => {
    const shortBreak = { id: "next", startDate: "2026-09-21", endDate: "2026-10-09" };
    expect(reportWritingTerm([T3, shortBreak], "2026-09-25")?.id).toBe("next");
  });
});

describe("checkEntry", () => {
  const ok = { summary: "Solid term.", effort: 4, homework: 3, understanding: 5 };
  it("accepts a summary and three ratings", () => {
    expect(checkEntry(ok)).toBeNull();
  });
  it("needs a summary", () => {
    expect(checkEntry({ ...ok, summary: "   " })).toBe("Write a summary of the term.");
  });
  it("needs each rating from 1 to 5", () => {
    expect(checkEntry({ ...ok, homework: 0 })).toBe("Rate homework from 1 to 5.");
    expect(checkEntry({ ...ok, effort: 6 })).toBe("Rate effort from 1 to 5.");
    expect(checkEntry({ ...ok, understanding: 2.5 })).toBe("Rate understanding from 1 to 5.");
  });
});

describe("ratingLabel", () => {
  it("names each point", () => {
    expect(ratingLabel(1)).toBe("Needs support");
    expect(ratingLabel(5)).toBe("Excellent");
  });
});
