import { describe, expect, it } from "vitest";
import {
  conversationDayLabel,
  formatClockTime,
  inboxStamp,
  melbourneDayKey,
  relativeTime,
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
    expect(inboxStamp(new Date("2026-10-11T01:00:30.000Z"), now)).toBe(
      "12:00 pm",
    );
  });
});
