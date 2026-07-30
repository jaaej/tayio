import { describe, it, expect } from "vitest";
import {
  resolveTerm,
  meetsCancelNotice,
  meetsRescheduleNotice,
  remaining,
  deriveCreditStatus,
  type TermRow,
} from "./reschedule-credits";

const terms: TermRow[] = [
  { id: "t1", startDate: "2026-07-20", endDate: "2026-09-25" },
  { id: "t2", startDate: "2026-10-12", endDate: "2026-12-18" },
];

describe("resolveTerm", () => {
  it("matches a date inside a term", () => {
    expect(resolveTerm("2026-08-01", terms)?.id).toBe("t1");
  });
  it("is inclusive of both boundaries", () => {
    expect(resolveTerm("2026-07-20", terms)?.id).toBe("t1");
    expect(resolveTerm("2026-09-25", terms)?.id).toBe("t1");
  });
  it("returns null between/outside terms", () => {
    expect(resolveTerm("2026-10-01", terms)).toBeNull();
    expect(resolveTerm("2026-01-01", terms)).toBeNull();
  });
});

describe("notice gates", () => {
  const now = new Date("2026-08-01T09:00:00");
  it("cancel needs at least 24h notice", () => {
    expect(meetsCancelNotice(now, "2026-08-02", "10:00:00")).toBe(true); // 25h
    expect(meetsCancelNotice(now, "2026-08-02", "09:00:00")).toBe(true); // exactly 24h
    expect(meetsCancelNotice(now, "2026-08-02", "08:00:00")).toBe(false); // 23h
  });
  it("reschedule needs at least 7 days notice", () => {
    expect(meetsRescheduleNotice(now, "2026-08-08", "09:00:00")).toBe(true); // exactly 7d
    expect(meetsRescheduleNotice(now, "2026-08-09", "09:00:00")).toBe(true); // 8d
    expect(meetsRescheduleNotice(now, "2026-08-07", "09:00:00")).toBe(false); // 6d
  });
});

describe("remaining", () => {
  it("never goes negative", () => {
    expect(remaining(3, 1)).toBe(2);
    expect(remaining(3, 3)).toBe(0);
    expect(remaining(3, 5)).toBe(0);
  });
});

describe("deriveCreditStatus", () => {
  it("redeemed is terminal", () => {
    expect(deriveCreditStatus("redeemed", "2026-09-25", "2026-10-01")).toBe("redeemed");
  });
  it("active before expiry, inclusive of the expiry day", () => {
    expect(deriveCreditStatus("active", "2026-09-25", "2026-09-01")).toBe("active");
    expect(deriveCreditStatus("active", "2026-09-25", "2026-09-25")).toBe("active");
  });
  it("expired after the expiry day", () => {
    expect(deriveCreditStatus("active", "2026-09-25", "2026-09-26")).toBe("expired");
  });
});
