import { describe, expect, it } from "vitest";
import { bucketCoverBoard, coverColumnFor, isInsideNoticeWindow } from "./cover-columns";

// 2026-10-11 09:00 in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-10T22:00:00.000Z");

describe("coverColumnFor", () => {
  it("puts claimed requests in Covered whatever their timing", () => {
    expect(coverColumnFor({ status: "claimed", date: "2026-10-11", startTime: "10:00:00" }, NOW)).toBe(
      "covered",
    );
  });

  it("puts open requests starting within 24 hours in Under 24 hours", () => {
    expect(coverColumnFor({ status: "open", date: "2026-10-11", startTime: "16:00:00" }, NOW)).toBe("urgent");
    expect(coverColumnFor({ status: "open", date: "2026-10-12", startTime: "09:00:00" }, NOW)).toBe("urgent");
  });

  it("puts open requests further out in Needs cover", () => {
    expect(coverColumnFor({ status: "open", date: "2026-10-12", startTime: "09:30:00" }, NOW)).toBe("open");
  });

  it("measures hours in Melbourne time, not UTC calendar days", () => {
    // 2026-10-12 08:00 Melbourne is 23h away even though it is "two days" ahead in UTC terms.
    expect(coverColumnFor({ status: "open", date: "2026-10-12", startTime: "08:00:00" }, NOW)).toBe("urgent");
  });
});

describe("isInsideNoticeWindow", () => {
  it("flags open requests between 24 and 48 hours away", () => {
    expect(isInsideNoticeWindow({ status: "open", date: "2026-10-12", startTime: "18:00:00" }, NOW)).toBe(true);
    expect(isInsideNoticeWindow({ status: "open", date: "2026-10-14", startTime: "18:00:00" }, NOW)).toBe(false);
    expect(isInsideNoticeWindow({ status: "claimed", date: "2026-10-12", startTime: "18:00:00" }, NOW)).toBe(false);
  });
});

describe("bucketCoverBoard", () => {
  it("splits rows into columns and keeps their order", () => {
    const rows = [
      { id: "a", status: "open", date: "2026-10-11", startTime: "16:00:00" },
      { id: "b", status: "claimed", date: "2026-10-12", startTime: "16:00:00" },
      { id: "c", status: "open", date: "2026-10-15", startTime: "16:00:00" },
      { id: "d", status: "open", date: "2026-10-20", startTime: "16:00:00" },
    ];
    const columns = bucketCoverBoard(rows, NOW);
    expect(columns.urgent.map((r) => r.id)).toEqual(["a"]);
    expect(columns.open.map((r) => r.id)).toEqual(["c", "d"]);
    expect(columns.covered.map((r) => r.id)).toEqual(["b"]);
  });
});
