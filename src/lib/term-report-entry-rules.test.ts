import { describe, expect, it } from "vitest";
import { checkEntry, reportWritingTerm } from "./term-report-entry-rules";

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
  const ok = { strengths: "Confident with algebra.", toWorkOn: "Showing working.", goals: "Finish every test." };
  it("accepts all three parts", () => {
    expect(checkEntry(ok)).toBeNull();
  });
  it("names the part that is missing", () => {
    expect(checkEntry({ ...ok, strengths: "  " })).toBe("Write the strengths part.");
    expect(checkEntry({ ...ok, goals: "" })).toBe("Write the goals for next term part.");
  });
  it("keeps each part short", () => {
    expect(checkEntry({ ...ok, toWorkOn: "x".repeat(1501) })).toBe("Keep to work on under 1500 characters.");
  });
});
