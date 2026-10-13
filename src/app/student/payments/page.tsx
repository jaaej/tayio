import Link from "next/link";
import { PageHeader, Pill, buttonVariants } from "@/components/admin/ui";
import { requireUnrestrictedStudent } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  getAdminContactForStudent,
  getInvoicesForStudent,
} from "../_lib/queries";
import {
  formatInvoiceDay,
  formatInvoiceInstant,
  summarizeInvoices,
} from "./_lib/invoice-summary";

/**
 * Billing-access students only (base students are redirected to their home).
 * Read only: status boxes, then every invoice with its status. Paying happens
 * through the parent account, so there is no pay action here.
 */
export default async function StudentPaymentsPage() {
  const user = await requireUnrestrictedStudent();
  const [rows, office] = await Promise.all([
    getInvoicesForStudent(user.id),
    getAdminContactForStudent(),
  ]);

  const now = new Date();
  const summary = summarizeInvoices(rows, now);
  const currency = rows[0]?.currency ?? "AUD";

  const tiles = [
    {
      label: "Outstanding",
      value: formatMoney(summary.outstanding, currency),
      sub: summary.outstanding > 0 ? "amount due" : "all settled",
      dot: "#D92D20",
      valueClass: summary.outstanding > 0 ? "text-[#B42318]" : "text-ink",
    },
    {
      label: "Overdue",
      value: String(summary.overdueCount),
      sub: summary.oldestOverdueDue
        ? `since ${formatInvoiceDay(summary.oldestOverdueDue, now)}`
        : "none",
      dot: "#E8890C",
      valueClass: "text-ink",
    },
    {
      label: "Paid invoices",
      value: String(summary.paidThisYear),
      sub: "this year",
      dot: "#16A34A",
      valueClass: "text-ink",
    },
  ];

  return (
    <div className="flex max-w-[1040px] flex-col gap-5">
      <PageHeader
        title="Payments"
        actions={
          office && (
            <Link
              href={`/student/messages/with/${office.id}`}
              className={cn(buttonVariants({ variant: "glass", size: "lg" }), "font-semibold")}
            >
              Message the office
            </Link>
          )
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3.5">
        {tiles.map((t) => (
          <div key={t.label} className="glass flex flex-col rounded-[22px] p-1.5">
            <span className="flex items-center gap-2 px-2.5 py-2 text-[13px] font-bold text-ink-soft">
              <span
                aria-hidden
                className="h-2 w-2 rounded-[4px]"
                style={{ backgroundColor: t.dot }}
              />
              {t.label}
            </span>
            <span className="panel flex items-baseline justify-between gap-2 px-3.5 py-3">
              <span className={cn("text-[26px] font-extrabold tabular-nums", t.valueClass)}>
                {t.value}
              </span>
              <span className="text-[12px] font-bold text-muted">{t.sub}</span>
            </span>
          </div>
        ))}
      </div>

      <section aria-labelledby="invoices-heading" className="glass rounded-[24px] p-1.5">
        <h2
          id="invoices-heading"
          className="px-3 pb-2.5 pt-2 text-[16px] font-extrabold text-ink"
        >
          Invoices
        </h2>
        <div className="panel overflow-hidden">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-[13px] text-muted">No invoices yet.</p>
          ) : (
            <ul>
              {rows.map((r) => {
                const overdue = r.status === "overdue";
                return (
                  <li
                    key={r.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 text-[13px] transition-colors last:border-b-0 hover:bg-[#F8F9FC] sm:grid-cols-[minmax(0,1.6fr)_150px_110px_130px]"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-bold text-ink">
                        {r.description ?? "Tuition invoice"}
                      </span>
                      <span className="text-[12px] text-muted">
                        Issued {formatInvoiceInstant(r.issuedAt, now)}
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
                      <Pill tone={INVOICE_STATUS_TONE[r.status] ?? "default"}>
                        {INVOICE_STATUS_LABEL[r.status] ?? r.status}
                      </Pill>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
