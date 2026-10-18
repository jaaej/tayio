import { describe, expect, it } from "vitest";
import { parseMonthParam } from "./month-param";

describe("parseMonthParam", () => {
  it("reads YYYY-MM as a zero-based month", () => {
    expect(parseMonthParam("2026-10")).toEqual({ year: 2026, month: 9 });
  });

  it("defaults to the Melbourne month, not the server's", () => {
    // 31 Oct 2026, 14:00 UTC is already 1 Nov in Melbourne.
    expect(parseMonthParam(undefined, new Date("2026-10-31T14:00:00Z"))).toEqual({ year: 2026, month: 10 });
  });

  it("ignores a malformed or out-of-range value", () => {
    const now = new Date("2026-03-10T00:00:00Z");
    expect(parseMonthParam("2026-13", now)).toEqual({ year: 2026, month: 2 });
    expect(parseMonthParam("oct", now)).toEqual({ year: 2026, month: 2 });
  });
});
