import { Card, CardLabel } from "@/components/ui/card";
import { StatusBadge } from "@/components/data/status-badge";
import { StatTile } from "@/components/data/stat-tile";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatMoney } from "@/lib/format";
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
} from "@/lib/status";
import {
  getInvoicesForParent,
  getOutstandingBalanceForParent,
} from "../_data";
import { SectionHeader } from "../_components/section-header";

export default async function ParentPaymentsPage() {
  const user = await requireRole("parent");
  const [rows, outstanding] = await Promise.all([
    getInvoicesForParent(user.id),
    getOutstandingBalanceForParent(user.id),
  ]);

  const paid = rows.filter((r) => r.status === "paid").length;
  const overdue = rows.filter((r) => r.status === "overdue").length;

  return (
    <div className="space-y-6">
      <header className="rise">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
          Payments
        </div>
        <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
          Invoices
        </h1>
      </header>

      <section
        className="grid grid-cols-2 lg:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="Outstanding"
          value={formatMoney(outstanding)}
          sub={outstanding > 0 ? "Awaiting payment" : "All paid up"}
          accent={outstanding > 0 ? "warn" : "success"}
        />
        <StatTile
          label="Paid"
          value={paid.toString()}
          sub="Settled invoices"
          accent="success"
        />
        <StatTile
          label="Overdue"
          value={overdue.toString()}
          sub={overdue === 0 ? "None overdue" : "Past due date"}
          accent={overdue === 0 ? "success" : "warn"}
        />
      </section>

      {outstanding > 0 && (
        <Card className="rise flex items-center justify-between gap-6">
          <div>
            <CardLabel>Total due</CardLabel>
            <div className="mt-1 text-3xl font-light text-ink tabular-nums">
              {formatMoney(outstanding)}
            </div>
            <div className="mt-1 text-xs text-muted">
              Payments are processed externally — confirmation arrives by email.
            </div>
          </div>
          <Button type="button" disabled>
            Pay (coming soon)
          </Button>
        </Card>
      )}

      <div className="rise" style={{ animationDelay: "100ms" }}>
        {rows.length === 0 ? (
          <Card>
            <p className="text-ink-soft">No invoices issued yet.</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <SectionHeader title="All invoices" />
            <div className="divide-y divide-hairline/60">
              {rows.map((r) => {
                const studentName = [r.studentFirstName, r.studentLastName]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-12 items-center gap-4 px-6 py-4"
                  >
                    <div className="col-span-5 min-w-0">
                      <div className="text-base text-ink truncate">
                        {r.description ?? "Tuition invoice"}
                      </div>
                      <div className="text-xs text-muted mt-0.5 truncate">
                        {studentName ? `${studentName} · ` : ""}Issued{" "}
                        {formatDateLong(r.issuedAt.toISOString().slice(0, 10))}
                      </div>
                    </div>
                    <div className="col-span-3 text-sm text-ink-soft">
                      Due {formatDateLong(r.dueDate)}
                    </div>
                    <div className="col-span-2 text-right text-base text-ink tabular-nums">
                      {formatMoney(Number(r.amount))}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <StatusBadge
                        label={INVOICE_STATUS_LABEL[r.status] ?? r.status}
                        className={INVOICE_STATUS_STYLE[r.status]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
