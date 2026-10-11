import { describe, expect, it } from "vitest";
import { classTimeRangeError } from "@/lib/recurring-lesson-rules";
import {
  defaultClassTimes,
  durationLabel,
  endTimeAfterStartChange,
  endTimeFor,
  usualLessonMinutes,
} from "./class-time";

describe("defaultClassTimes", () => {
  it("defaults the end after the start, never to the same value", () => {
    const { startTime, endTime } = defaultClassTimes(60);
    expect(startTime).toBe("16:00");
    expect(endTime).toBe("17:00");
    expect(classTimeRangeError(startTime, endTime)).toBeNull();
  });

  it("uses the given lesson length", () => {
    expect(defaultClassTimes(90).endTime).toBe("17:30");
  });

  it("falls back to an hour for a non-positive length", () => {
    expect(defaultClassTimes(0).endTime).toBe("17:00");
  });
});

describe("usualLessonMinutes", () => {
  it("picks the most common length among existing classes", () => {
    expect(
      usualLessonMinutes([
        { startTime: "16:00:00", endTime: "17:30:00" },
        { startTime: "10:00:00", endTime: "11:30:00" },
        { startTime: "09:00:00", endTime: "10:00:00" },
      ]),
    ).toBe(90);
  });

  it("ignores empty and backwards ranges and falls back to an hour", () => {
    expect(
      usualLessonMinutes([
        { startTime: null, endTime: null },
        { startTime: "14:10:00", endTime: "02:10:00" },
      ]),
    ).toBe(60);
  });

  it("breaks ties towards the shorter length", () => {
    expect(
      usualLessonMinutes([
        { startTime: "16:00", endTime: "17:30" },
        { startTime: "16:00", endTime: "17:00" },
      ]),
    ).toBe(60);
  });
});

describe("endTimeFor", () => {
  it("clamps at the end of the day", () => {
    expect(endTimeFor("23:30", 60)).toBe("23:59");
    expect(endTimeFor("23:59", 60)).toBe("");
  });
});

describe("endTimeAfterStartChange", () => {
  it("keeps the current lesson length when the start moves", () => {
    expect(
      endTimeAfterStartChange({
        previousStart: "16:00",
        previousEnd: "17:30",
        nextStart: "14:10",
        lessonMinutes: 60,
      }),
    ).toBe("15:40");
  });

  it("uses the usual length when the old range was not valid", () => {
    expect(
      endTimeAfterStartChange({
        previousStart: "16:00",
        previousEnd: "16:00",
        nextStart: "14:10",
        lessonMinutes: 60,
      }),
    ).toBe("15:10");
  });

  it("leaves the end alone while the start is being cleared", () => {
    expect(
      endTimeAfterStartChange({
        previousStart: "16:00",
        previousEnd: "17:00",
        nextStart: "",
        lessonMinutes: 60,
      }),
    ).toBe("17:00");
  });
});

describe("durationLabel", () => {
  it("formats hours and minutes", () => {
    expect(durationLabel("16:00", "17:30")).toBe("1 h 30 m");
    expect(durationLabel("16:00", "17:00")).toBe("1 h");
    expect(durationLabel("16:00", "16:45")).toBe("45 m");
    expect(durationLabel("16:00", "16:00")).toBeNull();
  });
});
