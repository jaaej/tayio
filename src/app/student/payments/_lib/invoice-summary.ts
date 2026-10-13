import { melbourneDayKey } from "@/lib/format";
import type { StudentInvoiceRow } from "../../_lib/queries";

/** Statuses that still have money owing. Matches getOutstandingBalanceForStudent. */
const OPEN_STATUSES = new Set<StudentInvoiceRow["status"]>([
  "unpaid",
  "overdue",
  "partially_paid",
]);

export type InvoiceSummary = {
  outstanding: number;
  overdueCount: number;
  /** Due date (YYYY-MM-DD) of the oldest overdue invoice, if any. */
  oldestOverdueDue: string | null;
  /** Invoices paid in the current Melbourne calendar year. */
  paidThisYear: number;
};

export function summarizeInvoices(
  rows: Pick<StudentInvoiceRow, "amount" | "status" | "dueDate" | "paidAt" | "issuedAt">[],
  now: Date,
): InvoiceSummary {
  const year = melbourneDayKey(now).slice(0, 4);
  let outstanding = 0;
  let overdueCount = 0;
  let oldestOverdueDue: string | null = null;
  let paidThisYear = 0;

  for (const r of rows) {
    if (OPEN_STATUSES.has(r.status)) outstanding += Number(r.amount);
    if (r.status === "overdue") {
      overdueCount += 1;
      if (oldestOverdueDue === null || r.dueDate < oldestOverdueDue) {
        oldestOverdueDue = r.dueDate;
      }
    }
    if (r.status === "paid") {
      const paidOn = melbourneDayKey(r.paidAt ?? r.issuedAt);
      if (paidOn.slice(0, 4) === year) paidThisYear += 1;
    }
  }

  return { outstanding, overdueCount, oldestOverdueDue, paidThisYear };
}

const dayMonthUtc = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const dayMonthYearUtc = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const weekdayUtc = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  weekday: "short",
});

/**
 * A postgres DATE (YYYY-MM-DD) as "16 Oct", or "Fri 16 Oct" with `weekday`.
 * The year is added when it is not the current Melbourne year, so an old
 * invoice never reads as this year's.
 */
export function formatInvoiceDay(
  isoDate: string,
  now: Date,
  { weekday = false }: { weekday?: boolean } = {},
): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = String(y) === melbourneDayKey(now).slice(0, 4);
  const day = (sameYear ? dayMonthUtc : dayMonthYearUtc).format(date);
  return weekday ? `${weekdayUtc.format(date)} ${day}` : day;
}

/** An instant (e.g. issued_at) on its Melbourne calendar day, as "2 Oct". */
export function formatInvoiceInstant(at: Date, now: Date): string {
  return formatInvoiceDay(melbourneDayKey(at), now);
}
