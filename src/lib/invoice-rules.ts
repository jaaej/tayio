import { melbourneDayKey } from "@/lib/format";

/**
 * One invoice rule for every role. An invoice is overdue when money is still
 * owed and its due date (a Melbourne calendar date) has passed; nothing has to
 * set the `overdue` status by hand (a stored `overdue` still counts).
 */

export const OPEN_INVOICE_STATUSES = ["unpaid", "overdue", "partially_paid"] as const;

export type InvoiceLike = {
  status: string;
  /** YYYY-MM-DD. */
  dueDate: string;
};

export function isInvoiceOpen(status: string): boolean {
  return (OPEN_INVOICE_STATUSES as readonly string[]).includes(status);
}

export function isInvoiceOverdue(invoice: InvoiceLike, today: string): boolean {
  return isInvoiceOpen(invoice.status) && (invoice.status === "overdue" || invoice.dueDate < today);
}

/** The status to show: an open invoice past its due date reads `overdue`. */
export function invoiceDisplayStatus(invoice: InvoiceLike, today: string): string {
  return isInvoiceOverdue(invoice, today) ? "overdue" : invoice.status;
}

export type InvoiceSummary = {
  outstanding: number;
  overdueCount: number;
  /** Due date (YYYY-MM-DD) of the oldest overdue invoice, if any. */
  oldestOverdueDue: string | null;
  /** Invoices paid in the current Melbourne calendar year. */
  paidThisYear: number;
};

/** The family's invoice tiles, the same for a student and a parent. */
export function summarizeInvoices(
  rows: readonly (InvoiceLike & { amount: string | number; paidAt: Date | null; issuedAt: Date })[],
  now: Date,
): InvoiceSummary {
  const today = melbourneDayKey(now);
  const year = today.slice(0, 4);
  let outstanding = 0;
  let overdueCount = 0;
  let oldestOverdueDue: string | null = null;
  let paidThisYear = 0;

  for (const r of rows) {
    if (isInvoiceOpen(r.status)) outstanding += Number(r.amount);
    if (isInvoiceOverdue(r, today)) {
      overdueCount += 1;
      if (oldestOverdueDue === null || r.dueDate < oldestOverdueDue) oldestOverdueDue = r.dueDate;
    }
    if (r.status === "paid" && melbourneDayKey(r.paidAt ?? r.issuedAt).slice(0, 4) === year) {
      paidThisYear += 1;
    }
  }
  return { outstanding, overdueCount, oldestOverdueDue, paidThisYear };
}
