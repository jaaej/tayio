import { describe, expect, it } from "vitest";
import { weekNumberOn } from "./week-plan-rules";

describe("weekNumberOn", () => {
  it("counts the term's first seven days as week 1", () => {
    expect(weekNumberOn("2026-10-05", "2026-10-05")).toBe(1);
    expect(weekNumberOn("2026-10-05", "2026-10-11")).toBe(1);
  });

  it("starts week 2 on day eight", () => {
    expect(weekNumberOn("2026-10-05", "2026-10-12")).toBe(2);
  });

  it("is not shifted by a daylight-saving change inside the term", () => {
    // Melbourne moves clocks forward on 4 Oct 2026.
    expect(weekNumberOn("2026-09-28", "2026-10-05")).toBe(2);
  });

  it("clamps dates before the term to week 1", () => {
    expect(weekNumberOn("2026-10-05", "2026-10-01")).toBe(1);
  });
});
