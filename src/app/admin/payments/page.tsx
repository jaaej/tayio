import { and, desc, eq, inArray, like, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Lock, Search } from "lucide-react";
import { STUDENT_TIERS, isUnrestrictedAdmin } from "@/lib/roles";
import { db } from "@/db/client";
import { familyLinks, invoices, notifications, profiles } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { formatInvoiceDay } from "@/lib/invoice-dates";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { AdminPinPrompt } from "@/components/admin/pin-gate";
import {
  Avatar,
  Empty,
  GlassPanel,
  MetricTile,
  PageHeader,
  SegmentedLinks,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import {
  PAYMENT_REMINDER_KEY_PREFIX,
  displayStatus,
  formatTotals,
  groupInvoicesByFamily,
  parseStatusFilter,
  summariseByStatus,
  type InvoiceStatus,
} from "./_lib/families";
import { NewInvoicePanel } from "./_components/new-invoice-panel";
import { InvoiceStatusSelect, MarkPaidButton } from "./_components/invoice-actions";
import { EditInvoicePanel } from "./_components/edit-invoice-panel";
import { SendReminderButton } from "./_components/send-reminder-button";

export const dynamic = "force-dynamic";

/** The four statuses an admin chases or checks; each tile filters the list. */
const TILE_STATUSES: { status: InvoiceStatus; label: string; tone: "bad" | "warn" | "default" | "good" }[] = [
  { status: "overdue", label: "Overdue", tone: "bad" },
  { status: "unpaid", label: "Unpaid", tone: "warn" },
  { status: "partially_paid", label: "Partially paid", tone: "default" },
  { status: "paid", label: "Paid", tone: "good" },
];

function paymentsHref(status: InvoiceStatus | null, q: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/admin/payments?${qs}` : "/admin/payments";
}

function invoiceMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(
    Number(amount),
  );
}

function fullName(first: string | null, last: string | null) {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await requireRole("admin");
  const params = await searchParams;
  const status = parseStatusFilter(params.status);
  const query = (params.q ?? "").trim().slice(0, 100);

  // Same rule as the revenue page and dashboard: reception (admin_restricted)
  // sees no dollar figures until the admin PIN is entered - not the totals,
  // not a family's balance, not a single invoice amount. Locked, they can
  // still find a family, mark an invoice paid, change its status and send a
  // reminder. Editing is hidden while locked because the form shows the amount.
  const owner = isUnrestrictedAdmin(user.app_metadata?.role as UserRole | undefined);
  const { unlocked, pinSet } = await getAdminSecurityState();
  const showMoney = owner || unlocked;

  const parent = alias(profiles, "parent");
  const student = alias(profiles, "student");

  const [rows, parents, students, familyRows] = await Promise.all([
    db
      .select({
        id: invoices.id,
        parentId: invoices.parentId,
        studentId: invoices.studentId,
        amount: invoices.amount,
        currency: invoices.currency,
        status: invoices.status,
        dueDate: invoices.dueDate,
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
      .orderBy(desc(invoices.issuedAt)),
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
      })
      .from(profiles)
      .where(eq(profiles.role, "parent"))
      .orderBy(profiles.firstName),
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(inArray(profiles.role, STUDENT_TIERS))
      .orderBy(profiles.firstName),
    db
      .select({ parentId: familyLinks.parentId, studentId: familyLinks.studentId })
      .from(familyLinks),
  ]);

  const parentOptions = parents.map((p) => ({
    id: p.id,
    name: fullName(p.firstName, p.lastName),
    email: p.email,
  }));
  const studentName = new Map(students.map((s) => [s.id, fullName(s.firstName, s.lastName)]));
  const studentOptions = students.map((s) => ({
    id: s.id,
    name: studentName.get(s.id) ?? "",
    parentIds: familyRows.filter((l) => l.studentId === s.id).map((l) => l.parentId),
  }));
  const childrenByParent = new Map<string, string[]>();
  for (const link of familyRows) {
    const name = studentName.get(link.studentId);
    if (!name) continue;
    childrenByParent.set(link.parentId, [...(childrenByParent.get(link.parentId) ?? []), name]);
  }

  const invoiceRows = rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    parentName: fullName(r.parentFirst, r.parentLast),
    parentEmail: r.parentEmail,
    studentId: r.studentId,
    studentName: r.studentFirst ? fullName(r.studentFirst, r.studentLast) : null,
    amount: r.amount,
    currency: r.currency,
    status: r.status as InvoiceStatus,
    dueDate: r.dueDate,
    paidAt: r.paidAt,
    description: r.description,
  }));

  const todayIso = melbourneDate();
  const summary = summariseByStatus(invoiceRows, todayIso);
  const families = groupInvoicesByFamily(invoiceRows, {
    status,
    today: todayIso,
    query,
    childrenByParent,
  });

  const familyIds = families.map((f) => f.parentId);
  const reminders =
    familyIds.length === 0
      ? []
      : await db
          .select({ userId: notifications.userId, at: max(notifications.createdAt) })
          .from(notifications)
          .where(
            and(
              inArray(notifications.userId, familyIds),
              like(notifications.dedupeKey, `${PAYMENT_REMINDER_KEY_PREFIX}%`),
            ),
          )
          .groupBy(notifications.userId);
  const lastReminder = new Map(reminders.map((r) => [r.userId, r.at]));

  const now = new Date();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payments"
        actions={
          <>
            <form
              action="/admin/payments"
              method="get"
              role="search"
              className="flex h-[42px] w-full items-center gap-2 rounded-[12px] bg-white px-3 text-muted focus-within:ring-2 focus-within:ring-brand-400 sm:w-[240px]"
            >
              <Search className="h-[15px] w-[15px] shrink-0" aria-hidden />
              {status && <input type="hidden" name="status" value={status} />}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Parent or student"
                aria-label="Search families"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
              />
            </form>
            <NewInvoicePanel parents={parentOptions} students={studentOptions} />
          </>
        }
      />

      {!showMoney && (
        <GlassPanel bodyClassName="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
            <Lock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            Amounts are hidden until the admin PIN is entered.
          </p>
          <AdminPinPrompt pinSet={pinSet} label="Admin PIN" />
        </GlassPanel>
      )}

      <nav aria-label="Filter by status" className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {TILE_STATUSES.map((tile) => {
          const { count, totals } = summary[tile.status];
          const active = status === tile.status;
          const noun = count === 1 ? "invoice" : "invoices";
          return (
            <MetricTile
              key={tile.status}
              label={tile.label}
              value={showMoney ? formatTotals(totals) : count}
              sub={showMoney ? `${count} ${noun}` : noun}
              tone={count > 0 ? tile.tone : "default"}
              href={paymentsHref(active ? null : tile.status, query)}
              active={active}
            />
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="pl-1 text-[16px] font-extrabold text-ink">Families</h2>
        <SegmentedLinks
          label="More statuses"
          items={[
            { label: "All", href: paymentsHref(null, query), active: status === null },
            {
              label: "Refunded",
              href: paymentsHref("refunded", query),
              active: status === "refunded",
              count: summary.refunded.count,
            },
            {
              label: "Cancelled",
              href: paymentsHref("cancelled", query),
              active: status === "cancelled",
              count: summary.cancelled.count,
            },
          ]}
        />
      </div>

      {families.length === 0 ? (
        <GlassPanel>
          <Empty>
            {rows.length === 0
              ? "No invoices yet."
              : query
                ? "No families match that search."
                : "No invoices with this status."}
          </Empty>
        </GlassPanel>
      ) : (
        families.map((family) => {
          const owes = family.openCount > 0;
          const reminded = lastReminder.get(family.parentId);
          const titleId = `family-${family.parentId}`;
          const metaParts = [
            family.children.join(", ") || family.parentEmail,
            owes ? (reminded ? `reminded ${relativeTime(reminded, now)}` : "not reminded yet") : null,
          ].filter(Boolean);
          return (
            <GlassPanel
              key={family.parentId}
              titleId={titleId}
              title={
                <span className="flex items-center gap-2.5">
                  <Avatar name={family.parentName} size={36} tone="brand" />
                  {family.parentName}
                </span>
              }
              meta={metaParts.join(" · ")}
              action={
                <>
                  <span className="flex flex-col items-end px-1.5 leading-tight">
                    <span
                      className={cn(
                        "text-[18px] font-extrabold tabular-nums",
                        owes ? "text-bad" : "text-good",
                      )}
                    >
                      {owes
                        ? showMoney
                          ? formatTotals(family.owing)
                          : `${family.openCount} open`
                        : "Paid up"}
                    </span>
                    {owes && (
                      <span className="text-[12px] font-semibold text-ink-soft">
                        {showMoney ? "owing" : family.openCount === 1 ? "invoice" : "invoices"}
                      </span>
                    )}
                  </span>
                  {owes && (
                    <SendReminderButton parentId={family.parentId} parentName={family.parentName} />
                  )}
                </>
              }
            >
              <ul className="divide-y divide-line">
                {family.invoices.map((r) => {
                  const shown = displayStatus(r, todayIso);
                  const pastDue = shown === "overdue";
                  const name = [r.description || "Invoice", r.studentName].filter(Boolean).join(" · ");
                  return (
                    <li
                      key={r.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-[13px] transition-colors hover:bg-[#F8F9FC] md:grid-cols-[minmax(0,1.6fr)_110px_150px_150px_136px]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-bold text-ink">{r.description || "Invoice"}</div>
                        {r.studentName && <div className="text-[12px] text-muted">{r.studentName}</div>}
                      </div>
                      <div className="text-right font-extrabold tabular-nums text-ink">
                        {showMoney ? (
                          invoiceMoney(r.amount, r.currency)
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">Amount hidden</span>
                          </span>
                        )}
                      </div>
                      <div className={cn("font-semibold tabular-nums", pastDue ? "text-bad" : "text-ink-soft")}>
                        <span className="sr-only">Due </span>
                        {formatInvoiceDay(r.dueDate, now, { weekday: true })}
                      </div>
                      <div className="justify-self-end md:justify-self-start">
                        <InvoiceStatusSelect
                          id={r.id}
                          status={r.status}
                          shown={shown}
                          label={`Status for ${name}`}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end gap-1.5 md:col-span-1">
                        {r.status !== "paid" && <MarkPaidButton id={r.id} />}
                        {showMoney && (
                        <EditInvoicePanel
                          key={`${r.id}:${r.status}:${r.amount}:${r.dueDate}:${r.parentId}:${r.studentId ?? ""}`}
                          label={name}
                          invoice={{
                            id: r.id,
                            parentId: r.parentId,
                            studentId: r.studentId,
                            amount: r.amount,
                            currency: r.currency,
                            dueDate: r.dueDate,
                            description: r.description,
                            status: r.status,
                            paidAt: r.paidAt,
                          }}
                          parents={parentOptions}
                          students={studentOptions}
                        />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </GlassPanel>
          );
        })
      )}
    </div>
  );
}
