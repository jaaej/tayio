import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { invoices, profiles } from "@/db/schema";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
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

const STATUS_TONE: Record<Status, "success" | "warn" | "danger" | "muted" | "neutral"> = {
  paid: "success",
  unpaid: "neutral",
  overdue: "danger",
  partially_paid: "warn",
  refunded: "muted",
  cancelled: "muted",
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
    .where(eq(profiles.role, "student"))
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

  return (
    <div className="space-y-10">
      <header className="rise">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Invoices
        </div>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Who has{" "}
          <span className="font-display">paid</span>, who hasn&apos;t.
        </h1>
        <p className="mt-3 text-sm text-ink-soft max-w-xl">
          Manual invoice tracking for the MVP. Stripe integration arrives in
          Phase 3 — mark payments here as they clear in your bank.
        </p>
      </header>

      <section className="grid sm:grid-cols-3 gap-4 rise">
        <Card>
          <CardLabel>Paid this view</CardLabel>
          <div className="mt-2 text-3xl font-light text-emerald-700">
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              maximumFractionDigits: 0,
            }).format(totals.paid)}
          </div>
        </Card>
        <Card>
          <CardLabel>Outstanding</CardLabel>
          <div className="mt-2 text-3xl font-light text-ink">
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              maximumFractionDigits: 0,
            }).format(totals.outstanding)}
          </div>
        </Card>
        <Card>
          <CardLabel>Overdue</CardLabel>
          <div className="mt-2 text-3xl font-light text-rose-700">
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              maximumFractionDigits: 0,
            }).format(totals.overdue)}
          </div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
          <CardLabel>Create invoice</CardLabel>
          <div className="mt-4">
            {parents.length === 0 ? (
              <div className="text-sm text-muted">
                Create a parent account first under User management.
              </div>
            ) : (
              <CreateInvoiceForm parents={parents} students={students} />
            )}
          </div>
        </Card>
      </section>

      <section className="rise" style={{ animationDelay: "120ms" }}>
        <Table>
          <THead>
            <TR>
              <TH>Parent</TH>
              <TH>Student</TH>
              <TH>Description</TH>
              <TH className="text-right">Amount</TH>
              <TH>Due</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <TR>
                <TD colSpan={7} className="text-center text-muted py-8">
                  No invoices yet.
                </TD>
              </TR>
            )}
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>
                  <div className="font-medium">
                    {r.parentFirst} {r.parentLast}
                  </div>
                  <div className="text-xs text-muted">{r.parentEmail}</div>
                </TD>
                <TD className="text-ink-soft">
                  {r.studentFirst
                    ? `${r.studentFirst} ${r.studentLast}`
                    : "—"}
                </TD>
                <TD className="text-ink-soft text-xs">
                  {r.description || "—"}
                </TD>
                <TD className="text-right font-medium">
                  {formatMoney(r.amount, r.currency)}
                </TD>
                <TD className="text-ink-soft text-xs">
                  {new Date(r.dueDate).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[r.status as Status]}>
                    {r.status.replace("_", " ")}
                  </Badge>
                </TD>
                <TD className="text-right">
                  <InvoiceActions id={r.id} status={r.status as Status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
