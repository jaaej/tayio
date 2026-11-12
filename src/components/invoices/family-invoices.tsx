import { Info } from "lucide-react";
import { MetricTile, Pill } from "@/components/admin/ui";
import { formatMoney, melbourneDayKey } from "@/lib/format";
import { formatInvoiceDay, formatInvoiceInstant } from "@/lib/invoice-dates";
import { invoiceDisplayStatus, isInvoiceOverdue, summarizeInvoices } from "@/lib/invoice-rules";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

export type FamilyInvoice = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  issuedAt: Date;
  /** YYYY-MM-DD. */
  dueDate: string;
  paidAt: Date | null;
  description: string | null;
  /** Who the invoice is for, shown when a family's invoices cover more than one child. */
  studentName?: string | null;
};

/**
 * The family's invoices, the same for a student with billing access and a
 * parent: Outstanding, Overdue and Paid tiles (the shared `MetricTile`, as
 * on the parent Overview and admin Payments), then every invoice with its
 * status. Overdue comes from the due date (`invoice-rules`), and every date
 * is a Melbourne calendar day. Read only: families pay by transfer or in
 * person, so the page header carries the way to the office.
 */
export function FamilyInvoices({ invoices, now }: { invoices: FamilyInvoice[]; now: Date }) {
  const summary = summarizeInvoices(invoices, now);
  const today = melbourneDayKey(now);
  const currency = invoices[0]?.currency ?? "AUD";
  const names = new Set(invoices.map((r) => r.studentName).filter(Boolean));
  const showStudent = names.size > 1;

  return (
    <>
      <section
        aria-label="Invoice summary"
        className="glass grid grid-cols-1 gap-1.5 rounded-[24px] p-1.5 sm:grid-cols-3"
      >
        <MetricTile
          label="Outstanding"
          value={formatMoney(summary.outstanding, currency)}
          sub={summary.outstanding > 0 ? "Payment due" : "All paid up"}
          tone={summary.outstanding > 0 ? "bad" : "good"}
        />
        <MetricTile
          label="Overdue"
          value={summary.overdueCount}
          sub={
            summary.oldestOverdueDue
              ? `Since ${formatInvoiceDay(summary.oldestOverdueDue, now)}`
              : "None"
          }
          tone={summary.overdueCount > 0 ? "bad" : "default"}
        />
        <MetricTile label="Paid invoices" value={summary.paidThisYear} sub="This year" />
      </section>

      {summary.outstanding > 0 && (
        <p className="glass flex items-start gap-2.5 rounded-[18px] px-4 py-3 text-[13px] font-semibold leading-[1.5] text-ink-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
          Pay by bank transfer or in person. Message the office for bank details or a receipt.
        </p>
      )}

      <section aria-labelledby="invoices-heading" className="glass rounded-[24px] p-1.5">
        <h2
          id="invoices-heading"
          className="px-3 pb-2.5 pt-2 text-[16px] font-extrabold text-ink"
        >
          Invoices
        </h2>
        <div className="panel overflow-hidden">
          {invoices.length === 0 ? (
            <p className="px-6 py-10 text-center text-[13px] text-muted">No invoices yet.</p>
          ) : (
            <ul>
              {invoices.map((r) => {
                const overdue = isInvoiceOverdue(r, today);
                const status = invoiceDisplayStatus(r, today);
                return (
                  <li
                    key={r.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 text-[13px] transition-colors last:border-b-0 hover:bg-[#F8F9FC] sm:grid-cols-[minmax(0,1.6fr)_150px_110px_130px]"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-bold text-ink">
                        {r.description ?? "Tuition invoice"}
                      </span>
                      <span className="truncate text-[12px] text-muted">
                        Issued {formatInvoiceInstant(r.issuedAt, now)}
                        {showStudent && r.studentName ? ` · ${r.studentName}` : ""}
                      </span>
                    </span>
                    <span className="text-right font-extrabold tabular-nums text-ink sm:order-3">
                      {formatMoney(Number(r.amount), r.currency)}
                    </span>
                    <span
                      className={cn(
                        "font-semibold sm:order-2",
                        overdue ? "text-[#B42318]" : "text-ink-soft",
                      )}
                    >
                      Due {formatInvoiceDay(r.dueDate, now, { weekday: true })}
                    </span>
                    <span className="text-right sm:order-4">
                      <Pill tone={INVOICE_STATUS_TONE[status] ?? "default"}>
                        {INVOICE_STATUS_LABEL[status] ?? status}
                      </Pill>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
