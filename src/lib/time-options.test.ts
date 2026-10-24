import { describe, expect, it } from "vitest";
import { timeOptions } from "./time-options";

describe("timeOptions", () => {
  it("steps through the day", () => {
    expect(timeOptions({ from: "16:00", to: "17:00", stepMinutes: 15 })).toEqual([
      "16:00", "16:15", "16:30", "16:45", "17:00",
    ]);
  });

  it("keeps a saved time that is off the grid, in order", () => {
    expect(timeOptions({ from: "16:00", to: "17:00", stepMinutes: 30, keep: "16:20:00" })).toEqual([
      "16:00", "16:20", "16:30", "17:00",
    ]);
  });
});

