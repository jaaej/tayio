import { describe, expect, it } from "vitest";
import { formatInvoiceDay, formatInvoiceInstant } from "./invoice-dates";

// 13 Oct 2026, 10:00 in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-12T23:00:00Z");

describe("formatInvoiceDay", () => {
  it("formats this year's dates without the year", () => {
    expect(formatInvoiceDay("2026-10-16", NOW)).toBe("16 Oct");
    expect(formatInvoiceDay("2026-10-16", NOW, { weekday: true })).toBe("Fri 16 Oct");
  });

  it("adds the year for other years", () => {
    expect(formatInvoiceDay("2025-03-10", NOW)).toBe("10 Mar 2025");
    expect(formatInvoiceDay("2025-03-10", NOW, { weekday: true })).toBe("Mon 10 Mar 2025");
  });
});

describe("formatInvoiceInstant", () => {
  it("uses the Melbourne calendar day", () => {
    // 1 Oct 2026 14:30 UTC is 2 Oct in Melbourne.
    expect(formatInvoiceInstant(new Date("2026-10-01T14:30:00Z"), NOW)).toBe("2 Oct");
  });

  it("does not fall a day early before 11 am Melbourne", () => {
    // Issued 9 am Melbourne on 14 Oct, which is still 13 Oct in UTC.
    expect(formatInvoiceInstant(new Date("2026-10-13T22:00:00Z"), NOW)).toBe("14 Oct");
  });
});
