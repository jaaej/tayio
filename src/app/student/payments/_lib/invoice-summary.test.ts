import { describe, expect, it } from "vitest";
import {
  formatInvoiceDay,
  formatInvoiceInstant,
  summarizeInvoices,
} from "./invoice-summary";

// 13 Oct 2026, 10:00 in Melbourne (AEDT, UTC+11).
const NOW = new Date("2026-10-12T23:00:00Z");

function row(
  status: "unpaid" | "paid" | "overdue" | "partially_paid" | "refunded" | "cancelled",
  amount: string,
  dueDate: string,
  paidAt: Date | null = null,
  issuedAt = new Date("2026-02-01T00:00:00Z"),
) {
  return { status, amount, dueDate, paidAt, issuedAt };
}

describe("summarizeInvoices", () => {
  it("sums open invoices and ignores settled ones", () => {
    const s = summarizeInvoices(
      [
        row("unpaid", "320.00", "2026-10-16"),
        row("overdue", "320.00", "2026-03-10"),
        row("partially_paid", "60.00", "2026-09-01"),
        row("paid", "320.00", "2026-07-14", new Date("2026-07-10T01:00:00Z")),
        row("refunded", "50.00", "2026-05-01"),
        row("cancelled", "80.00", "2026-05-01"),
      ],
      NOW,
    );
    expect(s.outstanding).toBe(700);
    expect(s.overdueCount).toBe(1);
    expect(s.oldestOverdueDue).toBe("2026-03-10");
    expect(s.paidThisYear).toBe(1);
  });

  it("picks the oldest overdue due date", () => {
    const s = summarizeInvoices(
      [row("overdue", "1", "2026-06-01"), row("overdue", "1", "2026-04-20")],
      NOW,
    );
    expect(s.oldestOverdueDue).toBe("2026-04-20");
    expect(s.overdueCount).toBe(2);
  });

  it("counts a payment by its Melbourne year, falling back to the issue date", () => {
    const s = summarizeInvoices(
      [
        // 31 Dec 2025 14:00 UTC is already 1 Jan 2026 in Melbourne.
        row("paid", "1", "2025-12-20", new Date("2025-12-31T14:00:00Z")),
        // Paid last year in Melbourne.
        row("paid", "1", "2025-12-20", new Date("2025-12-31T12:00:00Z")),
        // No paid_at recorded: issued this year.
        row("paid", "1", "2026-02-10", null, new Date("2026-02-01T00:00:00Z")),
      ],
      NOW,
    );
    expect(s.paidThisYear).toBe(2);
  });

  it("is empty for no invoices", () => {
    expect(summarizeInvoices([], NOW)).toEqual({
      outstanding: 0,
      overdueCount: 0,
      oldestOverdueDue: null,
      paidThisYear: 0,
    });
  });
});

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
});
