import { desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { STUDENT_TIERS } from "@/lib/roles";
import { Wallet, AlertTriangle, FileText } from "lucide-react";
import { db } from "@/db/client";
import { invoices, profiles } from "@/db/schema";
import {
  Card,
  CardHead,
  CardBody,
  Pill,
  StatTile,
  PageHeader,
  Empty,
  type PillTone,
} from "@/components/admin/ui";
import { CreateInvoiceForm } from "./_components/create-invoice-form";
import { InvoiceActions } from "./_components/invoice-actions";

export const dynamic = "force-dynamic";

type Status =
  | "unpaid"
  | "paid"
  | "overdue"
  | "partially_paid"
  | "refunded"
  | "cancelled";

const STATUS_TONE: Record<Status, PillTone> = {
  paid: "good",
  unpaid: "warn",
  overdue: "bad",
  partially_paid: "info",
  refunded: "grape",
  cancelled: "default",
};

function formatMoney(amount: string, currency: string) {
  const n = Number(amount);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(n);
}

export default async function PaymentsPage() {
  const parent = alias(profiles, "parent");
  const student = alias(profiles, "student");

  const rows = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      dueDate: invoices.dueDate,
      issuedAt: invoices.issuedAt,
      paidAt: invoices.paidAt,
      description: invoices.description,
      parentFirst: parent.firstName,
      parentLast: parent.lastName,
      parentEmail: parent.email,
      studentFirst: student.firstName,
      studentLast: student.lastName,
    })
    .from(invoices)
    .innerJoin(parent, eq(parent.id, invoices.parentId))
    .leftJoin(student, eq(student.id, invoices.studentId))
    .orderBy(desc(invoices.issuedAt));

  const parents = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
    })
    .from(profiles)
    .where(eq(profiles.role, "parent"))
    .orderBy(profiles.firstName);

  const students = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(inArray(profiles.role, STUDENT_TIERS))
    .orderBy(profiles.firstName);

  const totals = rows.reduce(
    (acc, r) => {
      const n = Number(r.amount);
      if (r.status === "paid") acc.paid += n;
      else if (r.status === "overdue") acc.overdue += n;
      else if (r.status === "unpaid" || r.status === "partially_paid")
        acc.outstanding += n;
      return acc;
    },
    { paid: 0, overdue: 0, outstanding: 0 },
  );

  const money0 = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Invoices"
        title="Who has paid, who hasn't"
        sub="Manual invoice tracking for the MVP. Stripe integration arrives in Phase 3 - mark payments here as they clear in your bank."
      />

      <section className="grid sm:grid-cols-3 gap-4 rise">
        <StatTile
          label="Paid this view"
          value={money0(totals.paid)}
          icon={<Wallet className="h-5 w-5" />}
          tone="good"
          accent
        />
        <StatTile
          label="Outstanding"
          value={money0(totals.outstanding)}
          icon={<FileText className="h-5 w-5" />}
          tone="brand"
          accent
        />
        <StatTile
          label="Overdue"
          value={money0(totals.overdue)}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={totals.overdue > 0 ? "bad" : "good"}
          accent
        />
      </section>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardHead title="Create invoice" />
          <CardBody>
            {parents.length === 0 ? (
              <div className="text-[13px] text-muted">
                Create a parent account first under User management.
              </div>
            ) : (
              <CreateInvoiceForm parents={parents} students={students} />
            )}
          </CardBody>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Card>
          <CardHead title="All invoices" />
          {rows.length === 0 ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
                    <th className="text-left px-5 py-2.5">Parent</th>
                    <th className="text-left px-5 py-2.5">Student</th>
                    <th className="text-left px-5 py-2.5">Description</th>
                    <th className="text-right px-5 py-2.5">Amount</th>
                    <th className="text-left px-5 py-2.5">Due</th>
                    <th className="text-left px-5 py-2.5">Status</th>
                    <th className="text-right px-5 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-line hover:bg-surface-2 transition-colors"
                    >
                      <td className="px-5 py-3 text-[13px]">
                        <div className="font-bold text-ink">
                          {r.parentFirst} {r.parentLast}
                        </div>
                        <div className="text-[12px] text-muted">
                          {r.parentEmail}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-ink-soft">
                        {r.studentFirst
                          ? `${r.studentFirst} ${r.studentLast}`
                          : "-"}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-ink-soft">
                        {r.description || "-"}
                      </td>
                      <td className="px-5 py-3 text-right text-[13px] font-extrabold tabular-nums text-ink">
                        {formatMoney(r.amount, r.currency)}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-ink-soft tabular-nums">
                        {new Date(r.dueDate).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={STATUS_TONE[r.status as Status]}>
                          {r.status.replace("_", " ")}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <InvoiceActions id={r.id} status={r.status as Status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
