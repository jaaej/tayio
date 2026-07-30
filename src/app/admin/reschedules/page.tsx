import { Card, CardHead, Empty, PageHeader, Pill, type PillTone } from "@/components/admin/ui";
import { RescheduleRequestList } from "@/components/reschedule/request-list";
import { getCreditsOverview } from "@/app/admin/_lib/queries";
import { requireRole } from "@/lib/auth";
import { formatDateLong } from "@/lib/format";
import { CANCEL_CAP, RESCHEDULE_CAP, type CreditStatus } from "@/lib/reschedule-credits";
import { listPendingRequests } from "@/lib/reschedule";

const STATUS_TONE: Record<CreditStatus, PillTone> = {
  active: "good",
  redeemed: "info",
  expired: "default",
};

const STATUS_LABEL: Record<CreditStatus, string> = {
  active: "Active",
  redeemed: "Redeemed",
  expired: "Expired",
};

const REASON_LABEL: Record<"cancellation" | "reschedule_no_slot", string> = {
  cancellation: "Cancellation",
  reschedule_no_slot: "No slot available",
};

export default async function AdminReschedulesPage() {
  await requireRole("admin");
  const [requests, { credits, usage }] = await Promise.all([
    listPendingRequests({}),
    getCreditsOverview(),
  ]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        className="rise"
        eyebrow="Reschedules"
        title="Reschedule requests"
        sub="All pending reschedule requests across classes. Approve or decline below."
      />

      <RescheduleRequestList requests={requests} />

      <Card className="rise">
        <CardHead
          title="Class credits"
          eyebrow="Read-only"
          action={<Pill tone="default">{credits.length}</Pill>}
        />
        {credits.length === 0 ? (
          <Empty>No class credits yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
                  <th className="text-left px-5 py-2.5">Student</th>
                  <th className="text-left px-5 py-2.5">Subject</th>
                  <th className="text-left px-5 py-2.5">Status</th>
                  <th className="text-left px-5 py-2.5">Reason</th>
                  <th className="text-left px-5 py-2.5">Granted from</th>
                  <th className="text-left px-5 py-2.5">Redeemed on</th>
                  <th className="text-left px-5 py-2.5">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {credits.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3 font-bold text-ink whitespace-nowrap">
                      {c.studentFirst} {c.studentLast}
                    </td>
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap">
                      {c.subjectName}
                    </td>
                    <td className="px-5 py-3">
                      <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                    </td>
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap">
                      {REASON_LABEL[c.grantReason]}
                    </td>
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap">
                      {c.grantedFromLabel ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap">
                      {c.redeemedOnLabel ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-ink-soft tabular-nums whitespace-nowrap">
                      {formatDateLong(c.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="rise">
        <CardHead
          title="This term's usage"
          eyebrow="Read-only"
          action={<Pill tone="default">{usage.length}</Pill>}
        />
        {usage.length === 0 ? (
          <Empty>No usage this term.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
                  <th className="text-left px-5 py-2.5">Student</th>
                  <th className="text-right px-5 py-2.5">Cancellations used</th>
                  <th className="text-right px-5 py-2.5">Reschedules used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {usage.map((u) => (
                  <tr key={u.studentId} className="hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3 font-bold text-ink whitespace-nowrap">
                      {u.studentFirst} {u.studentLast}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                      {u.cancellationsUsed} of {CANCEL_CAP}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                      {u.reschedulesUsed} of {RESCHEDULE_CAP}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
