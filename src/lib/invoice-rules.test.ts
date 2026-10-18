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
