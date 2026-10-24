import { afterEach, describe, expect, it } from "vitest";
import {
  formatDateLong,
  formatDateShort,
  formatDayDate,
  formatDueDate,
  formatMonthShort,
  melbourneGreeting,
  formatTime,
  formatTimeRange,
  conversationDayLabel,
  formatClockTime,
  formatDateTime,
  inboxStamp,
  melbourneDayKey,
  relativeTime,
  weekRangeLabel,
  yearLevelLabel,
} from "./format";

describe("relativeTime", () => {
  const now = new Date("2026-09-20T05:00:00.000Z");

  it("updates in minutes until the one-hour mark", () => {
    expect(relativeTime(new Date("2026-09-20T04:59:30.000Z"), now)).toBe(
      "just now",
    );
    expect(relativeTime(new Date("2026-09-20T04:55:00.000Z"), now)).toBe(
      "5m ago",
    );
    expect(relativeTime(new Date("2026-09-20T04:01:00.000Z"), now)).toBe(
      "59m ago",
    );
  });

  it("switches to whole hours at sixty minutes", () => {
    expect(relativeTime(new Date("2026-09-20T04:00:00.000Z"), now)).toBe(
      "1h ago",
    );
    expect(relativeTime(new Date("2026-09-20T00:01:00.000Z"), now)).toBe(
      "4h ago",
    );
  });
});

describe("yearLevelLabel", () => {
  it("prefixes only bare numbers", () => {
    expect(yearLevelLabel("10")).toBe("Year 10");
    expect(yearLevelLabel("Year 10")).toBe("Year 10");
    expect(yearLevelLabel("VCE")).toBe("VCE");
  });
});

describe("formatTime", () => {
  it("reads postgres 24h times as afternoon, not morning", () => {
    expect(formatTime("14:10")).toBe("2:10 pm");
    expect(formatTime("14:10:00")).toBe("2:10 pm");
    expect(formatTime("02:10:00")).toBe("2:10 am");
  });

  it("leaves off :00 on the hour", () => {
    expect(formatTime("16:00:00")).toBe("4 pm");
    expect(formatTime("09:30:00")).toBe("9:30 am");
  });

  it("handles noon and midnight", () => {
    expect(formatTime("12:00:00")).toBe("12 pm");
    expect(formatTime("12:30")).toBe("12:30 pm");
    expect(formatTime("00:05:00")).toBe("12:05 am");
    expect(formatTime("00:15")).toBe("12:15 am");
  });
});

describe("formatTimeRange", () => {
  it("writes the meridiem once when both ends share it, with a plain hyphen", () => {
    expect(formatTimeRange("14:10:00", "15:10:00")).toBe("2:10 - 3:10 pm");
    expect(formatTimeRange("16:00", "17:30")).toBe("4 - 5:30 pm");
    expect(formatTimeRange("16:30:00", "18:30:00")).toBe("4:30 - 6:30 pm");
  });

  it("writes both meridiems across noon", () => {
    expect(formatTimeRange("11:30:00", "12:30:00")).toBe("11:30 am - 12:30 pm");
    expect(formatTimeRange("11:30", "13:00")).toBe("11:30 am - 1 pm");
  });
});

describe("inbox timestamps (Melbourne time)", () => {
  // Sun 11 Oct 2026, 12:00 pm in Melbourne (AEDT, UTC+11).
  const now = new Date("2026-10-11T01:00:00.000Z");

  it("uses the Melbourne calendar day, not the server's UTC day", () => {
    // 10 Oct 22:41 UTC is already 11 Oct 9:41 am in Melbourne.
    const d = new Date("2026-10-10T22:41:00.000Z");
    expect(melbourneDayKey(d)).toBe("2026-10-11");
    expect(formatClockTime(d)).toBe("9:41 am");
    expect(inboxStamp(d, now)).toBe("9:41 am");
    expect(conversationDayLabel(d, now)).toBe("Today");
  });

  it("writes clock times like schedule times, on the Melbourne clock", () => {
    // 05:00 UTC is 4 pm in Melbourne; 13:05 UTC is 12:05 am the next day.
    expect(formatClockTime(new Date("2026-10-25T05:00:00.000Z"))).toBe("4 pm");
    expect(formatClockTime(new Date("2026-10-25T13:05:00.000Z"))).toBe("12:05 am");
    expect(formatDateTime(new Date("2026-10-25T05:30:00.000Z"))).toBe("25 Oct, 4:30 pm");
    expect(formatDateTime(new Date("2026-10-25T13:05:00.000Z"), true)).toBe("26 Oct 2026, 12:05 am");
    // The server's month names, which Safari would otherwise write as Jul / Sep.
    expect(formatDateTime(new Date("2026-07-01T07:18:00.000Z"))).toBe("1 July, 5:18 pm");
    expect(formatDateTime(new Date("2026-09-20T06:14:00.000Z"))).toBe("20 Sept, 4:14 pm");
  });

  it("says Yesterday, then the weekday within the last week", () => {
    const yesterday = new Date("2026-10-10T02:00:00.000Z");
    expect(inboxStamp(yesterday, now)).toBe("Yesterday");
    expect(conversationDayLabel(yesterday, now)).toBe("Yesterday");

    const thursday = new Date("2026-10-08T02:00:00.000Z");
    expect(inboxStamp(thursday, now)).toBe("Thu");
    expect(conversationDayLabel(thursday, now)).toBe("Thu 8 Oct");
  });

  it("falls back to the date, adding the year only for other years", () => {
    expect(inboxStamp(new Date("2026-05-24T02:00:00.000Z"), now)).toBe(
      "24 May",
    );
    expect(inboxStamp(new Date("2025-05-24T02:00:00.000Z"), now)).toBe(
      "24 May 2025",
    );
    expect(
      conversationDayLabel(new Date("2026-09-30T02:00:00.000Z"), now),
    ).toBe("30 Sept");
  });

  it("treats a slightly future instant (clock skew) as today", () => {
    expect(inboxStamp(new Date("2026-10-11T01:00:30.000Z"), now)).toBe("12 pm");
  });
});

describe("melbourneGreeting", () => {
  it("follows Melbourne time, not the server clock", () => {
    // 2026-10-13 is AEDT (UTC+11).
    expect(melbourneGreeting(new Date("2026-10-12T20:00:00Z"))).toBe("Good morning");
    expect(melbourneGreeting(new Date("2026-10-13T03:00:00Z"))).toBe("Good afternoon");
    expect(melbourneGreeting(new Date("2026-10-13T07:00:00Z"))).toBe("Good evening");
  });
});

describe("formatMonthShort", () => {
  it("names the month of a lesson date", () => {
    expect(formatMonthShort("2026-10-19")).toBe("Oct");
    expect(formatMonthShort("2026-11-02")).toBe("Nov");
  });
});

describe("dates from a moment read as the Melbourne day on any server", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it("shows a midnight Melbourne due date on its own day on a UTC server", () => {
    process.env.TZ = "UTC";
    // 00:00 on Sat 24 Oct in Melbourne is 13:00 UTC on Fri 23 Oct.
    const due = new Date("2026-10-23T13:00:00Z");
    expect(formatDueDate(due)).toBe("Sat 24 Oct");
    expect(formatDateLong(due)).toMatch(/^Saturday,? 24 October$/);
  });
});

describe("short dates", () => {
  // Safari's Intl writes "Jun", "Jul", "Sep"; these must read as the server does.
  it("write the server's short month names", () => {
    expect(formatDateShort("2026-06-13")).toBe("13 June");
    expect(formatDateShort("2026-09-05")).toBe("5 Sept");
    expect(formatDayDate("2026-06-30")).toBe("Tue 30 June");
    expect(weekRangeLabel("2026-10-12")).toBe("12 - 18 Oct");
    expect(weekRangeLabel("2026-09-28")).toBe("28 Sept - 4 Oct");
    expect(formatDueDate(new Date("2026-07-14T02:00:00.000Z"))).toBe("Tue 14 July");
  });
});
