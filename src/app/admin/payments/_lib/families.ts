import {
  OPEN_INVOICE_STATUSES,
  invoiceDisplayStatus,
  isInvoiceOverdue,
} from "@/lib/invoice-rules";

/*
 * Pure helpers for the admin Payments page: status filter parsing, money
 * totals, and grouping invoices into families (one billed parent account and
 * the children it pays for). No DB access, so every rule here is unit tested.
 * Overdue is the shared invoice rule (`@/lib/invoice-rules`): open and past
 * its due date, whatever status is stored.
 */

export const INVOICE_STATUSES = [
  "unpaid",
  "paid",
  "overdue",
  "partially_paid",
  "refunded",
  "cancelled",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Statuses that still have money owing. */
export const OPEN_STATUSES: readonly InvoiceStatus[] = OPEN_INVOICE_STATUSES;

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  overdue: "Overdue",
  partially_paid: "Partially paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return (
    typeof value === "string" &&
    (INVOICE_STATUSES as readonly string[]).includes(value)
  );
}

export function isOpenStatus(status: InvoiceStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** `?status=` value, or null (show every status) when missing or unknown. */
export function parseStatusFilter(value: string | undefined): InvoiceStatus | null {
  return isInvoiceStatus(value) ? value : null;
}

export type MoneyTotal = { currency: string; amount: number };

/**
 * Sum amounts per currency (invoices may be billed in more than one), in
 * whole cents to avoid float drift. Sorted by currency code.
 */
export function sumByCurrency(
  rows: { amount: string | number; currency: string }[],
): MoneyTotal[] {
  const cents = new Map<string, number>();
  for (const row of rows) {
    const currency = row.currency.toUpperCase();
    const value = Math.round(Number(row.amount) * 100);
    if (!Number.isFinite(value)) continue;
    cents.set(currency, (cents.get(currency) ?? 0) + value);
  }
  return [...cents.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, amount: total / 100 }));
}

/** "$640" or "$160.50"; several currencies are joined with " + ". */
export function formatTotals(totals: MoneyTotal[], fallbackCurrency = "AUD"): string {
  const list = totals.length > 0 ? totals : [{ currency: fallbackCurrency, amount: 0 }];
  return list
    .map(({ currency, amount }) =>
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency,
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(amount),
    )
    .join(" + ");
}

export type FamilyInvoiceInput = {
  id: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentName: string | null;
  amount: string;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  description: string | null;
};

export type Family<T extends FamilyInvoiceInput> = {
  parentId: string;
  parentName: string;
  parentEmail: string;
  /** Linked children plus any child named on an invoice, de-duplicated. */
  children: string[];
  /** Invoices matching the status filter, earliest due first. */
  invoices: T[];
  /** Owing across every open invoice of the family, whatever the filter. */
  owing: MoneyTotal[];
  openCount: number;
  overdueCount: number;
};

/** The status an invoice shows and files under: open and past due reads overdue. */
export function displayStatus(
  invoice: { status: InvoiceStatus; dueDate: string },
  today: string,
): InvoiceStatus {
  return invoiceDisplayStatus(invoice, today) as InvoiceStatus;
}

/**
 * Group invoices by the billed parent account. Every invoice has a parent
 * (`invoices.parent_id` is NOT NULL), so the parent is the family key.
 *
 * - `status` keeps only invoices showing that status (`displayStatus`, so
 *   "overdue" means past due); families left with none are dropped. Owing is
 *   always the family's full open balance, because a reminder covers every
 *   open invoice, not just the filtered ones.
 * - `query` matches parent name or email, a linked child, or a child named on
 *   an invoice (case-insensitive).
 * - Families with overdue invoices come first, then the largest balance, then
 *   name.
 */
export function groupInvoicesByFamily<T extends FamilyInvoiceInput>(
  invoices: T[],
  opts: {
    status: InvoiceStatus | null;
    /** Melbourne date (YYYY-MM-DD) that decides overdue. */
    today: string;
    query?: string;
    childrenByParent?: Map<string, string[]>;
  },
): Family<T>[] {
  const byParent = new Map<string, T[]>();
  for (const invoice of invoices) {
    const list = byParent.get(invoice.parentId);
    if (list) list.push(invoice);
    else byParent.set(invoice.parentId, [invoice]);
  }

  const needle = (opts.query ?? "").trim().toLowerCase();
  const families: Family<T>[] = [];

  for (const [parentId, all] of byParent) {
    const first = all[0];
    const children = dedupe([
      ...(opts.childrenByParent?.get(parentId) ?? []),
      ...all.map((invoice) => invoice.studentName ?? ""),
    ]);

    if (needle) {
      const haystack = [first.parentName, first.parentEmail, ...children].map((s) =>
        s.toLowerCase(),
      );
      if (!haystack.some((s) => s.includes(needle))) continue;
    }

    const shown = (
      opts.status ? all.filter((i) => displayStatus(i, opts.today) === opts.status) : [...all]
    ).sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
    );
    if (shown.length === 0) continue;

    const open = all.filter((invoice) => isOpenStatus(invoice.status));
    families.push({
      parentId,
      parentName: first.parentName,
      parentEmail: first.parentEmail,
      children,
      invoices: shown,
      owing: sumByCurrency(open),
      openCount: open.length,
      overdueCount: all.filter((invoice) => isInvoiceOverdue(invoice, opts.today)).length,
    });
  }

  const owingValue = (family: Family<T>) =>
    family.owing.reduce((acc, total) => acc + total.amount, 0);
  return families.sort(
    (a, b) =>
      Number(b.overdueCount > 0) - Number(a.overdueCount > 0) ||
      owingValue(b) - owingValue(a) ||
      a.parentName.localeCompare(b.parentName),
  );
}

/** Per-status count and money totals for the filter tiles, by shown status. */
export function summariseByStatus(
  invoices: { amount: string; currency: string; status: InvoiceStatus; dueDate: string }[],
  today: string,
): Record<InvoiceStatus, { count: number; totals: MoneyTotal[] }> {
  const result = {} as Record<InvoiceStatus, { count: number; totals: MoneyTotal[] }>;
  for (const status of INVOICE_STATUSES) {
    const rows = invoices.filter((invoice) => displayStatus(invoice, today) === status);
    result[status] = { count: rows.length, totals: sumByCurrency(rows) };
  }
  return result;
}

function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export const PAYMENT_REMINDER_TITLE = "Payment reminder";
export const PAYMENT_REMINDER_KEY_PREFIX = "payment-reminder:";

/** One reminder per family per Melbourne day (enforced by the unique
 *  `(user_id, dedupe_key)` index on notifications). */
export function paymentReminderDedupeKey(parentId: string, melbourneIsoDate: string): string {
  return `${PAYMENT_REMINDER_KEY_PREFIX}${parentId}:${melbourneIsoDate}`;
}

/** Notification body sent to the parent for their open invoices. */
export function buildPaymentReminderBody(
  open: { amount: string; currency: string; status: InvoiceStatus; dueDate: string }[],
  today: string,
): string {
  const count = open.length;
  const overdue = open.filter((invoice) => isInvoiceOverdue(invoice, today)).length;
  const total = formatTotals(sumByCurrency(open));
  const noun = count === 1 ? "invoice" : "invoices";
  const verb = count === 1 ? "is" : "are";
  const overdueNote = overdue > 0 ? `, including ${overdue} overdue` : "";
  return `You have ${count} ${noun} totalling ${total} that ${verb} awaiting payment${overdueNote}. Open Payments to see the details.`;
}
