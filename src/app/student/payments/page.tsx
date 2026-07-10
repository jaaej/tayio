import { Card, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { StatTile } from "@/components/student/kpi";
import { requireUnrestrictedStudent } from "@/lib/auth";
import { formatDateLong, formatMoney } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE } from "@/lib/status";
import {
  getInvoicesForStudent,
  getOutstandingBalanceForStudent,
} from "../_lib/queries";

export default async function StudentPaymentsPage() {
  const user = await requireUnrestrictedStudent();
  const [rows, outstanding] = await Promise.all([
    getInvoicesForStudent(user.id),
    getOutstandingBalanceForStudent(user.id),
  ]);

  const paid = rows.filter((r) => r.status === "paid").length;
  const overdue = rows.filter((r) => r.status === "overdue").length;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Payments"
        title="Invoices & balance"
        sub="Your invoice history and anything still outstanding."
      />

      <div className="grid grid-cols-3 gap-3.5">
        <StatTile
          label="Outstanding"
          value={formatMoney(outstanding)}
          accent={outstanding > 0 ? "warn" : "success"}
          sub={outstanding > 0 ? "Amount due" : "All settled"}
        />
        <StatTile label="Paid invoices" value={paid} accent="success" />
        <StatTile
          label="Overdue"
          value={overdue}
          accent={overdue > 0 ? "warn" : "brand"}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-muted">No invoices yet.</div>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-ink truncate">
                    {r.description ?? "Tuition invoice"}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5">
                    Issued {formatDateLong(r.issuedAt)} · Due{" "}
                    {formatDateLong(r.dueDate)}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[14px] font-extrabold tabular-nums text-ink">
                    {formatMoney(Number(r.amount), r.currency)}
                  </span>
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold " +
                      (INVOICE_STATUS_STYLE[r.status] ?? "bg-brand-50 text-ink-soft")
                    }
                  >
                    {INVOICE_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
