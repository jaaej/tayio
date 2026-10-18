import { describe, expect, it } from "vitest";
import { timeOptionLabel, timeOptions } from "./time-options";

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

describe("timeOptionLabel", () => {
  it("reads like the schedule", () => {
    expect(timeOptionLabel("12:30")).toBe("12:30 pm");
    expect(timeOptionLabel("13:30:00")).toBe("1:30 pm");
    expect(timeOptionLabel("00:15")).toBe("12:15 am");
  });
});
