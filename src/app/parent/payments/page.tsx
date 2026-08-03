import Link from "next/link";
import { CreditCard, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Card,
  StatTile,
  PageHeader,
  Empty,
} from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatMoney } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE } from "@/lib/status";
import {
  getInvoicesForParent,
  getOutstandingBalanceForParent,
} from "../_data";
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
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "30ms" }}
      >
        <StatTile
          label="Outstanding"
          value={formatMoney(outstanding)}
          icon={<CreditCard className="h-5 w-5" />}
          tone={outstanding > 0 ? "warn" : "good"}
          accent
          delta={outstanding > 0 ? "Payment due" : "All paid up"}
          deltaTone={outstanding > 0 ? "down" : "up"}
        />
        <StatTile
          label="Paid"
          value={paid.toString()}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="mint"
          accent
          delta="Invoices settled"
        />
        <StatTile
          label="Overdue"
          value={overdue.toString()}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={overdue === 0 ? "good" : "coral"}
          accent
          delta="Past due date"
          deltaTone={overdue === 0 ? "up" : "down"}
        />
      </section>

      {outstanding > 0 && (
        <div className="rise" style={{ animationDelay: "50ms" }}>
          <Card accent="warn">
            <div className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
                  Total due
                </div>
                <div className="mt-1 text-3xl font-extrabold tracking-[-0.02em] text-ink tabular-nums">
                  {formatMoney(outstanding)}
                </div>
                <div className="mt-1 text-xs text-muted">
                  Payments are made by bank transfer or in person. Message the
                  office if you need bank details or a receipt - confirmation
                  arrives by email once it clears.
                </div>
              </div>
              <Link
                href="/parent/messages"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-brand-500 px-4 text-sm font-bold text-white hover:bg-brand-600 transition-colors"
              >
                Contact the office
              </Link>
            </div>
          </Card>
        </div>
      )}

      <div className="rise" style={{ animationDelay: "70ms" }}>
        {rows.length === 0 ? (
          <Card>
            <Empty>No invoices issued yet.</Empty>
          </Card>
        ) : (
          <Card>
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
                      <Td className="text-ink-soft">{studentName || "-"}</Td>
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
