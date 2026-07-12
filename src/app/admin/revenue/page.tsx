import { DollarSign, TrendingUp, AlertTriangle, Lock } from "lucide-react";
import {
  Card,
  CardHead,
  StatTile,
  PageHeader,
  Pill,
  Empty,
} from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { formatMoney, relativeTime } from "@/lib/format";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { getRevenueSummary, getRecentPayments } from "@/app/admin/_lib/queries";
import { AdminPinPrompt } from "@/components/admin/pin-gate";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  await requireRole("admin");
  const { unlocked, pinSet } = await getAdminSecurityState();

  // Locked: never query or render any figure — the number must not reach the
  // DOM. Show the PIN prompt (or a "set a PIN" nudge) instead.
  if (!unlocked) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader className="rise" eyebrow="Finance" title="Revenue" />
        <Card className="rise">
          <div className="flex flex-col items-start gap-3 p-6">
            <div className="flex items-center gap-2 text-[14px] font-bold text-ink">
              <Lock className="h-4 w-4 text-muted" aria-hidden />
              Revenue is locked
            </div>
            <p className="text-[13px] text-muted max-w-prose">
              Financial figures are hidden behind the admin PIN. Unlock to view
              them for this session.
            </p>
            <AdminPinPrompt pinSet={pinSet} label="Enter admin PIN to view revenue" />
          </div>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const [summary, payments] = await Promise.all([
    getRevenueSummary(now),
    getRecentPayments(8),
  ]);

  const delta =
    summary.revenueLastMonth > 0
      ? Math.round(
          ((summary.revenueMonth - summary.revenueLastMonth) /
            summary.revenueLastMonth) *
            100,
        )
      : null;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Finance"
        title="Revenue"
        sub="Payments received, by month. Visible only while the admin PIN is unlocked."
        actions={<Pill tone="good">Unlocked</Pill>}
      />

      <section
        className="grid grid-cols-2 lg:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="This month"
          value={formatMoney(summary.revenueMonth)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="mint"
          accent
        />
        <StatTile
          label="Last month"
          value={formatMoney(summary.revenueLastMonth)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="brand"
          accent
        />
        <StatTile
          label="Overdue outstanding"
          value={formatMoney(summary.overdueTotal)}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="coral"
          accent
        />
      </section>

      {delta !== null && (
        <p className="text-[13px] text-muted rise">
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last month ·{" "}
          {summary.overdueCount} overdue invoice
          {summary.overdueCount === 1 ? "" : "s"}
        </p>
      )}

      <Card className="rise">
        <CardHead
          title="Recent payments"
          action={<Pill tone="default">{payments.length}</Pill>}
        />
        {payments.length === 0 ? (
          <Empty>No payments recorded yet.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-ink truncate">
                    {p.parentFirst} {p.parentLast}
                  </div>
                  {p.at && (
                    <div className="text-[12px] text-muted mt-0.5">
                      {relativeTime(new Date(p.at))}
                    </div>
                  )}
                </div>
                <div className="text-[14px] font-bold text-ink tabular-nums shrink-0">
                  {formatMoney(Number(p.amount))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
