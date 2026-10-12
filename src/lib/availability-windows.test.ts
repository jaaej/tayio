import { describe, expect, it } from "vitest";
import {
  availableWindowsOnDate,
  coversTime,
  mergeWindows,
  weekdayOf,
  weeklyWindowsByDay,
} from "./availability-windows";

// 2026-10-12 is a Monday.
const MONDAY = "2026-10-12";
const hourly = (weekday: number, from: number, to: number) =>
  Array.from({ length: to - from }, (_, index) => ({
    id: `${weekday}-${from + index}`,
    weekday,
    startTime: `${String(from + index).padStart(2, "0")}:00:00`,
    endTime: `${String(from + index + 1).padStart(2, "0")}:00:00`,
  }));

describe("mergeWindows", () => {
  it("joins touching and overlapping windows and drops empty ones", () => {
    expect(
      mergeWindows([
        { start: 600, end: 660 },
        { start: 540, end: 600 },
        { start: 700, end: 700 },
        { start: 650, end: 720 },
      ]),
    ).toEqual([{ start: 540, end: 720 }]);
  });
});

describe("weekdayOf", () => {
  it("reads the calendar weekday without the server time zone", () => {
    expect(weekdayOf(MONDAY)).toBe(1);
    expect(weekdayOf("2026-10-18")).toBe(0);
  });
});

describe("availableWindowsOnDate", () => {
  const weekly = hourly(1, 15, 18);

  it("uses the weekly hours on a normal date", () => {
    expect(availableWindowsOnDate(weekly, [], MONDAY)).toEqual([
      { start: 900, end: 1080 },
    ]);
  });

  it("ignores weekly hours on another weekday", () => {
    expect(availableWindowsOnDate(weekly, [], "2026-10-13")).toEqual([]);
  });

  it("replaces the weekly hours when the date is isolated", () => {
    expect(
      availableWindowsOnDate(
        weekly,
        [
          { date: MONDAY, startTime: "00:00:00", endTime: "23:59:59", isAvailable: false },
          { date: MONDAY, startTime: "10:00:00", endTime: "11:00:00", isAvailable: true },
        ],
        MONDAY,
      ),
    ).toEqual([{ start: 600, end: 660 }]);
  });

  it("removes one weekly slot marked unavailable on the date", () => {
    expect(
      availableWindowsOnDate(
        weekly,
        [{ date: MONDAY, startTime: "16:00:00", endTime: "17:00:00", isAvailable: false }],
        MONDAY,
      ),
    ).toEqual([
      { start: 900, end: 960 },
      { start: 1020, end: 1080 },
    ]);
  });

  it("only applies date rows to their own date", () => {
    expect(
      availableWindowsOnDate(
        weekly,
        [{ date: "2026-10-19", startTime: "00:00:00", endTime: "23:59:59", isAvailable: false }],
        MONDAY,
      ),
    ).toEqual([{ start: 900, end: 1080 }]);
  });
});

describe("coversTime", () => {
  const windows = [{ start: 900, end: 1080 }];

  it("accepts a lesson fully inside a window", () => {
    expect(coversTime(windows, "16:00:00", "17:30:00")).toBe(true);
    expect(coversTime(windows, "15:00", "18:00")).toBe(true);
  });

  it("rejects a lesson that runs past the window", () => {
    expect(coversTime(windows, "17:30:00", "18:30:00")).toBe(false);
    expect(coversTime([], "16:00:00", "17:00:00")).toBe(false);
  });
});

describe("weeklyWindowsByDay", () => {
  it("returns every day Monday first with merged windows and their rule ids", () => {
    const days = weeklyWindowsByDay([...hourly(1, 15, 17), ...hourly(0, 9, 10)]);
    expect(days.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days[0].windows).toEqual([
      { start: 900, end: 1020, ruleIds: ["1-15", "1-16"] },
    ]);
    expect(days[1].windows).toEqual([]);
    expect(days[6].windows).toEqual([{ start: 540, end: 600, ruleIds: ["0-9"] }]);
  });
});
