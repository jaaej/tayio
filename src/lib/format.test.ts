import { describe, expect, it } from "vitest";
import { relativeTime } from "./format";

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
