import { describe, expect, it } from "vitest";
import {
  formatTime,
  formatTimeRange,
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

describe("formatTime", () => {
  it("reads postgres 24h times as afternoon, not morning", () => {
    expect(formatTime("14:10")).toBe("2:10pm");
    expect(formatTime("14:10:00")).toBe("2:10pm");
    expect(formatTime("02:10:00")).toBe("2:10am");
  });

  it("handles noon and midnight", () => {
    expect(formatTime("12:00:00")).toBe("12:00pm");
    expect(formatTime("00:05:00")).toBe("12:05am");
  });
});

describe("formatTimeRange", () => {
  it("writes the meridiem once when both ends share it", () => {
    expect(formatTimeRange("14:10:00", "15:10:00")).toBe("2:10 – 3:10 pm");
    expect(formatTimeRange("16:00", "17:30")).toBe("4:00 – 5:30 pm");
  });

  it("writes both meridiems across noon", () => {
    expect(formatTimeRange("11:30:00", "12:30:00")).toBe("11:30 am – 12:30 pm");
  });
});
