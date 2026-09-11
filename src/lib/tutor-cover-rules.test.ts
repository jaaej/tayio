import { describe, expect, it } from "vitest";
import {
  hoursUntilLesson,
  inclusiveDayCount,
  lessonStartInstant,
  melbourneDate,
  nextCoverUrgency,
  tutorCoverClassLabel,
  tutorCoverDateLabel,
  tutorCoverLessonDescription,
} from "./tutor-cover-rules";

describe("tutor cover timing", () => {
  it("interprets lesson wall time across Melbourne daylight saving", () => {
    expect(lessonStartInstant("2026-09-10", "18:00:00").toISOString()).toBe(
      "2026-09-10T08:00:00.000Z",
    );
    expect(lessonStartInstant("2026-12-10", "18:00:00").toISOString()).toBe(
      "2026-12-10T07:00:00.000Z",
    );
  });

  it("calculates exact notice hours", () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    expect(hoursUntilLesson("2026-09-10", "18:00:00", now)).toBe(48);
  });

  it("uses Melbourne's calendar date", () => {
    expect(melbourneDate(new Date("2026-09-03T15:30:00.000Z"))).toBe(
      "2026-09-04",
    );
  });

  it("counts an inclusive leave range", () => {
    expect(inclusiveDayCount("2026-09-01", "2026-09-14")).toBe(14);
  });

  it("does not repeat a subject or weekday in a lesson description", () => {
    expect(
      tutorCoverClassLabel("Year 9 Maths", "Year 9 Maths · Saturday AM"),
    ).toBe("Year 9 Maths · Saturday AM");
    expect(
      tutorCoverDateLabel("2026-09-12", "Year 9 Maths · Saturday AM"),
    ).toBe("12 September");
    expect(
      tutorCoverLessonDescription({
        subjectName: "Year 9 Maths",
        className: "Year 9 Maths · Saturday AM",
        date: "2026-09-12",
        startTime: "10:00:00",
        endTime: "11:30:00",
      }),
    ).toBe("Year 9 Maths · Saturday AM, 12 September 10:00am–11:30am");
  });

  it("sends each deadline escalation once and lets 24h supersede 48h", () => {
    expect(
      nextCoverUrgency({
        hoursRemaining: 47,
        alert48Sent: false,
        alert24Sent: false,
      }),
    ).toBe("48h");
    expect(
      nextCoverUrgency({
        hoursRemaining: 23,
        alert48Sent: false,
        alert24Sent: false,
      }),
    ).toBe("24h");
    expect(
      nextCoverUrgency({
        hoursRemaining: 23,
        alert48Sent: true,
        alert24Sent: true,
      }),
    ).toBeNull();
    expect(
      nextCoverUrgency({
        hoursRemaining: -1,
        alert48Sent: true,
        alert24Sent: true,
      }),
    ).toBe("expired");
  });
});
