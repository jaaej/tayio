import { describe, expect, it } from "vitest";
import { invoiceDisplayStatus, isInvoiceOverdue, summarizeInvoices } from "./invoice-rules";

const today = "2026-10-18";

describe("isInvoiceOverdue", () => {
  it("is overdue once an open invoice passes its due date, without anyone setting it", () => {
    expect(isInvoiceOverdue({ status: "unpaid", dueDate: "2026-10-17" }, today)).toBe(true);
    expect(isInvoiceOverdue({ status: "partially_paid", dueDate: "2026-10-01" }, today)).toBe(true);
  });

  it("is not overdue on its due date, when paid, or when cancelled", () => {
    expect(isInvoiceOverdue({ status: "unpaid", dueDate: today }, today)).toBe(false);
    expect(isInvoiceOverdue({ status: "paid", dueDate: "2026-01-01" }, today)).toBe(false);
    expect(isInvoiceOverdue({ status: "cancelled", dueDate: "2026-01-01" }, today)).toBe(false);
  });

  it("still counts an invoice an admin marked overdue", () => {
    expect(invoiceDisplayStatus({ status: "overdue", dueDate: "2026-12-01" }, today)).toBe("overdue");
  });
});

describe("summarizeInvoices", () => {
  it("counts a past-due unpaid invoice as overdue for the family", () => {
    const now = new Date("2026-10-18T01:00:00Z");
    const issuedAt = new Date("2026-09-01T00:00:00Z");
    expect(
      summarizeInvoices(
        [
          { status: "unpaid", dueDate: "2026-10-01", amount: "120.00", paidAt: null, issuedAt },
          { status: "unpaid", dueDate: "2026-11-01", amount: "80", paidAt: null, issuedAt },
          { status: "paid", dueDate: "2026-09-15", amount: "50", paidAt: new Date("2026-09-10T00:00:00Z"), issuedAt },
        ],
        now,
      ),
    ).toEqual({ outstanding: 200, overdueCount: 1, oldestOverdueDue: "2026-10-01", paidThisYear: 1 });
  });
});

describe("summarizeInvoices (family tiles)", () => {
  // 13 Oct 2026, 10:00 in Melbourne (AEDT, UTC+11).
  const NOW = new Date("2026-10-12T23:00:00Z");
  const row = (
    status: string,
    amount: string,
    dueDate: string,
    paidAt: Date | null = null,
    issuedAt = new Date("2026-02-01T00:00:00Z"),
  ) => ({ status, amount, dueDate, paidAt, issuedAt });

  it("sums open invoices, ignores settled ones and counts overdue by due date", () => {
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
    // The part-paid invoice due 1 Sep is overdue too, though nobody set it.
    expect(s.overdueCount).toBe(2);
    expect(s.oldestOverdueDue).toBe("2026-03-10");
    expect(s.paidThisYear).toBe(1);
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
