import { describe, expect, it } from "vitest";
import { correctionLines, type CorrectableEntry, type ScheduledLesson } from "./corrections";

const entry = (over: Partial<CorrectableEntry>): CorrectableEntry => ({
  lessonId: "l1",
  workDate: "2026-10-10",
  startTime: "10:00:00",
  endTime: "11:30:00",
  subjectName: "Year 9 Maths",
  note: null,
  isManualOverride: true,
  isRemoved: false,
  ...over,
});

const schedule = (lessons: Record<string, ScheduledLesson>) => new Map(Object.entries(lessons));
const saturday = { date: "2026-10-10", startTime: "10:00:00", endTime: "11:00:00" };

describe("correctionLines", () => {
  it("says which time admin changed, against the lesson's schedule", () => {
    expect(correctionLines([entry({})], schedule({ l1: saturday }))).toEqual([
      "Admin changed Saturday's end time to 11:30 am",
    ]);
    expect(correctionLines([entry({ startTime: "09:30:00", endTime: "11:00:00" })], schedule({ l1: saturday }))).toEqual([
      "Admin changed Saturday's start time to 9:30 am",
    ]);
    expect(correctionLines([entry({ startTime: "09:30:00" })], schedule({ l1: saturday }))).toEqual([
      "Admin changed Saturday's times to 9:30 - 11:30 am",
    ]);
  });

  it("names the lesson when the day has two", () => {
    const other = entry({ lessonId: "l2", isManualOverride: false, startTime: "13:00:00", endTime: "14:00:00", subjectName: "VCE Methods" });
    expect(correctionLines([entry({}), other], schedule({ l1: saturday }))).toEqual([
      "Admin changed Saturday's Year 9 Maths end time to 11:30 am",
    ]);
  });

  it("covers removed, moved and otherwise corrected lessons, with admin's note", () => {
    expect(correctionLines([entry({ isRemoved: true, isManualOverride: false })], schedule({ l1: saturday }))).toEqual([
      "Admin took Saturday's Year 9 Maths off your pay",
    ]);
    expect(
      correctionLines([entry({ workDate: "2026-10-11", endTime: "11:00:00" })], schedule({ l1: saturday })),
    ).toEqual(["Admin moved Year 9 Maths to Sunday, 10 - 11 am"]);
    expect(
      correctionLines([entry({ lessonId: null, note: "Rate fixed" })], schedule({})),
    ).toEqual(["Admin corrected Saturday's Year 9 Maths: Rate fixed"]);
  });

  it("is empty when nothing was corrected", () => {
    expect(correctionLines([entry({ isManualOverride: false })], schedule({ l1: saturday }))).toEqual([]);
  });
});
