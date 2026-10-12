import { describe, expect, it } from "vitest";
import { weekSpanLabel, weekStartFromParam } from "./week-nav";

describe("week navigation", () => {
  it("normalises ?week= to its Monday and ignores bad input", () => {
    expect(weekStartFromParam("2026-10-15", "2026-10-12")).toBe("2026-10-12");
    expect(weekStartFromParam(undefined, "2026-10-14")).toBe("2026-10-12");
    expect(weekStartFromParam("next", "2026-10-14")).toBe("2026-10-12");
    expect(weekStartFromParam("2026-13-45", "2026-10-14")).toBe("2026-10-12");
  });

  it("labels the week span with the month once", () => {
    expect(weekSpanLabel("2026-10-12")).toBe("12 – 18 Oct");
    expect(weekSpanLabel("2026-09-28")).toBe("28 Sept – 4 Oct");
  });
});
