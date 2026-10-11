import { Lock, LockOpen } from "lucide-react";
import {
  Avatar,
  Empty,
  GlassPanel,
  MetricTile,
  PageHeader,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { isUnrestrictedAdmin } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { formatMoney, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import {
  getOverdueSummary,
  getRecentPayments,
  getReportTerms,
} from "@/app/admin/_lib/queries";
import { getMonthlyRevenue } from "@/app/admin/_lib/dashboard-queries";
import { AdminPinPrompt } from "@/components/admin/pin-gate";
import { RevenueBars } from "@/app/admin/_components/revenue-bars";
import { RevenueReportDownload } from "./_components/report-download";

export const dynamic = "force-dynamic";

function LockState({ locked }: { locked: boolean }) {
  const Icon = locked ? Lock : LockOpen;
  return (
    <span
      className={cn(
        "inline-flex h-[34px] items-center gap-2 rounded-[11px] px-3 text-[13px] font-extrabold",
        locked ? "bg-ink text-white" : "bg-good-bg text-good",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
      {locked ? "Locked" : "Unlocked"}
    </span>
  );
}

export default async function RevenuePage() {
  // The owner sees revenue with no PIN. Reception (admin_restricted) must enter
  // the PIN the owner set - the PIN's only job is to gate reception from money.
  const user = await requireRole("admin");
  const owner = isUnrestrictedAdmin(
    user.app_metadata?.role as UserRole | undefined,
  );
  const { unlocked, pinSet } = await getAdminSecurityState();
  const canView = owner || unlocked;

  // Locked reception: never query or render any figure - the number must not
  // reach the DOM. Show the PIN prompt (or a "set a PIN" nudge) instead.
  if (!canView) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Revenue" actions={<LockState locked />} />
        <section
          aria-labelledby="revenue-locked"
          className="glass mx-auto mt-4 w-full max-w-[480px] rounded-[24px] p-1.5 sm:mt-10"
        >
          <div className="panel flex flex-col items-center gap-3 p-7 text-center">
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-ink text-white">
              <Lock className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
            </span>
            <h2 id="revenue-locked" className="text-[18px] font-extrabold text-ink">
              Revenue is locked
            </h2>
            <p className="text-[14px] leading-relaxed text-muted">
              Enter the admin PIN to see figures. One unlock lasts about 30
              minutes.
            </p>
            <div className="pt-1.5">
              <AdminPinPrompt pinSet={pinSet} label="Enter admin PIN to view revenue" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  const now = new Date();
  const [months, overdue, payments, reportTerms] = await Promise.all([
    getMonthlyRevenue(now),
    getOverdueSummary(now),
    getRecentPayments(8),
    getReportTerms(),
  ]);

  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const delta =
    lastMonth && lastMonth.total > 0
      ? Math.round(((thisMonth.total - lastMonth.total) / lastMonth.total) * 100)
      : null;
  const lastMonthName = lastMonth
    ? new Date(`${lastMonth.key}-15T12:00:00`).toLocaleDateString("en-AU", {
        month: "long",
      })
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Revenue" actions={<LockState locked={false} />} />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricTile
          label="This month"
          value={formatMoney(thisMonth.total)}
          sub={
            delta === null ? (
              "Collected so far"
            ) : (
              <span className={cn("font-bold", delta >= 0 ? "text-good" : "text-bad")}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last month
              </span>
            )
          }
        />
        <MetricTile
          label="Last month"
          value={formatMoney(lastMonth?.total ?? 0)}
          sub={lastMonthName ?? undefined}
        />
        <MetricTile
          label="Overdue outstanding"
          value={formatMoney(overdue.overdueTotal)}
          tone={overdue.overdueCount > 0 ? "bad" : "default"}
          sub={
            <span className={cn(overdue.overdueCount > 0 && "font-bold text-bad")}>
              {overdue.overdueCount} overdue invoice
              {overdue.overdueCount === 1 ? "" : "s"}
            </span>
          }
        />
      </div>

      <GlassPanel title="Collected per month" titleId="revenue-months" meta="Last 6 months">
        <div className="p-4">
          <RevenueBars months={months} />
        </div>
      </GlassPanel>

      <div className="flex flex-wrap items-start gap-5">
        <GlassPanel
          title="Financial report"
          titleId="revenue-report"
          meta="PDF"
          className="min-w-0 flex-[1_1_320px]"
        >
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[13px] leading-relaxed text-muted">
              Revenue collected and overdue invoices for a month, term, or
              custom range.
            </p>
            <RevenueReportDownload terms={reportTerms} />
          </div>
        </GlassPanel>

        <GlassPanel
          title="Recent payments"
          titleId="revenue-payments"
          className="min-w-0 flex-[2_1_420px]"
        >
          {payments.length === 0 ? (
            <Empty>No payments recorded yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {payments.map((p) => {
                const parentName = `${p.parentFirst} ${p.parentLast}`.trim();
                const studentName = p.studentFirst
                  ? `${p.studentFirst} ${p.studentLast ?? ""}`.trim()
                  : null;
                const detail = [
                  studentName,
                  p.description,
                  p.at ? relativeTime(new Date(p.at), now) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8F9FC]"
                  >
                    <Avatar name={parentName} size={34} tone="brand" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-bold text-ink">
                        {parentName}
                      </div>
                      {detail && (
                        <div className="truncate text-[12px] text-muted">{detail}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-[14px] font-extrabold tabular-nums text-good">
                      +
                      {new Intl.NumberFormat("en-AU", {
                        style: "currency",
                        currency: p.currency,
                      }).format(Number(p.amount))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
