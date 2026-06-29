import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatMoney } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE } from "@/lib/status";
import {
  getInvoicesForParent,
  getOutstandingBalanceForParent,
} from "../_data";
import { PageHeader } from "../_components/page-header";
import { Kpi } from "../_components/kpi";
import { StatusPill } from "../_components/status-pill";
import { Table, Th, Td, Tr } from "../_components/table";

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
      <PageHeader
        title="Payments & invoices"
        sub="Your invoice history and upcoming payments."
      />

      <section
        className="grid grid-cols-3 gap-4 rise"
        style={{ animationDelay: "30ms" }}
      >
        <Kpi
          label="Outstanding"
          value={formatMoney(outstanding)}
          sub={outstanding > 0 ? "Payment due" : "All paid up"}
          delta={outstanding > 0 ? "down" : "up"}
        />
        <Kpi label="Paid" value={paid.toString()} sub="Invoices settled" />
        <Kpi
          label="Overdue"
          value={overdue.toString()}
          sub="Past due date"
          delta={overdue === 0 ? "up" : "down"}
        />
      </section>

      {outstanding > 0 && (
        <Card
          className="rise flex flex-wrap items-center justify-between gap-4"
          style={{ animationDelay: "50ms" }}
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
              Total due
            </div>
            <div className="mt-1 text-3xl font-extrabold tracking-[-0.02em] text-ink tabular-nums">
              {formatMoney(outstanding)}
            </div>
            <div className="mt-1 text-xs text-muted">
              Payments are processed externally — confirmation arrives by email.
            </div>
          </div>
          <Button type="button" variant="brand" disabled>
            Pay (coming soon)
          </Button>
        </Card>
      )}

      <div className="rise" style={{ animationDelay: "70ms" }}>
        {rows.length === 0 ? (
          <Card>
            <p className="text-ink-soft">No invoices issued yet.</p>
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Student</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Due</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const studentName = [r.studentFirstName, r.studentLastName]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <Tr key={r.id}>
                      <Td>
                        <div className="font-bold text-ink">
                          {r.description ?? "Tuition invoice"}
                        </div>
                        <div className="text-xs text-muted">
                          Issued{" "}
                          {formatDateLong(
                            r.issuedAt.toISOString().slice(0, 10),
                          )}
                        </div>
                      </Td>
                      <Td className="text-ink-soft">{studentName || "—"}</Td>
                      <Td className="text-right tabular-nums font-extrabold text-ink">
                        {formatMoney(Number(r.amount))}
                      </Td>
                      <Td className="text-muted whitespace-nowrap">
                        {formatDateLong(r.dueDate)}
                      </Td>
                      <Td>
                        <StatusPill
                          label={INVOICE_STATUS_LABEL[r.status] ?? r.status}
                          className={INVOICE_STATUS_STYLE[r.status]}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
