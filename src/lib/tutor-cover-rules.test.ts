import { describe, expect, it } from "vitest";
import {
  coverReturnedAlertFlags,
  coverReturnedNotice,
  formatTimeUntil,
  hoursUntilLesson,
  inclusiveDayCount,
  lessonStartInstant,
  melbourneDate,
  nextCoverUrgency,
  pendingLeaveRemindersDue,
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
    ).toBe("Year 9 Maths · Saturday AM, 12 September 10 - 11:30 am");
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

describe("cover returned to the board", () => {
  const now = new Date("2026-11-06T09:00:00.000Z");

  it("counts as the current deadline alert so the sweep does not repeat it", () => {
    // More than 48 hours away: both deadline alerts are still to come.
    expect(coverReturnedAlertFlags(60, now)).toEqual({
      alert48SentAt: null,
      alert24SentAt: null,
    });
    // Inside 48 hours: this notice is the 48-hour alert; the 24-hour one follows.
    expect(coverReturnedAlertFlags(30, now)).toEqual({
      alert48SentAt: now,
      alert24SentAt: null,
    });
    // Inside 24 hours: this notice is the last alert before class.
    expect(coverReturnedAlertFlags(10, now)).toEqual({
      alert48SentAt: now,
      alert24SentAt: now,
    });
  });

  it("agrees with the sweep about which alert comes next", () => {
    const flags = coverReturnedAlertFlags(30, now);
    expect(
      nextCoverUrgency({
        hoursRemaining: 30,
        alert48Sent: Boolean(flags.alert48SentAt),
        alert24Sent: Boolean(flags.alert24SentAt),
      }),
    ).toBeNull();
    expect(
      nextCoverUrgency({
        hoursRemaining: 20,
        alert48Sent: Boolean(flags.alert48SentAt),
        alert24Sent: Boolean(flags.alert24SentAt),
      }),
    ).toBe("24h");
  });

  it("is one notice for admins, urgent only inside 48 hours", () => {
    const detail = "Year 9 Maths · Saturday AM, 12 September 10 - 11:30 am";
    expect(coverReturnedNotice(detail, 30)).toEqual({
      title: "URGENT: Cover returned to the board",
      body: `${detail} needs a replacement again. The class starts in 30 hours.`,
    });
    expect(coverReturnedNotice(detail, 72.5)).toEqual({
      title: "Cover returned to the board",
      body: `${detail} needs a replacement again. The class starts in 3 days.`,
    });
  });

  it("states the time left in the unit a person would use", () => {
    expect(formatTimeUntil(0.25)).toBe("15 minutes");
    expect(formatTimeUntil(0.01)).toBe("1 minute");
    expect(formatTimeUntil(1.5)).toBe("1 hour");
    expect(formatTimeUntil(47.9)).toBe("47 hours");
    expect(formatTimeUntil(48)).toBe("2 days");
    expect(formatTimeUntil(24 * 9 + 5)).toBe("9 days");
  });
});

describe("pending leave reminders", () => {
  const created = new Date("2026-11-01T00:00:00.000Z");

  it("falls due every 24 hours after the request was made", () => {
    expect(pendingLeaveRemindersDue(created, new Date("2026-11-01T23:59:00.000Z"))).toBe(0);
    expect(pendingLeaveRemindersDue(created, new Date("2026-11-02T00:00:00.000Z"))).toBe(1);
    expect(pendingLeaveRemindersDue(created, new Date("2026-11-03T12:00:00.000Z"))).toBe(2);
  });

  it("never counts backwards for a clock behind the request", () => {
    expect(pendingLeaveRemindersDue(created, new Date("2026-10-31T00:00:00.000Z"))).toBe(0);
  });
});
