import { Card, CardBody, CardHead, Empty, PageHeader, Pill, type PillTone } from "@/components/admin/ui";
import { getCreditsOverview } from "@/app/admin/_lib/queries";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { type CreditStatus } from "@/lib/reschedule-credits";
import { getAdminCoverOverview, runTutorCoverReminders } from "@/lib/tutor-cover";
import {
  tutorCoverClassLabel,
  tutorCoverDateLabel,
} from "@/lib/tutor-cover-rules";
import {
  AssignCoverForm,
  LeaveDecisionButtons,
  ReopenCoverButton,
} from "./_components/cover-controls";

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

const REASON_LABEL: Record<
  "cancellation" | "reschedule_no_slot" | "admin_grant",
  string
> = {
  cancellation: "Cancellation",
  reschedule_no_slot: "No slot available",
  admin_grant: "Admin grant",
};

export default async function AdminReschedulesPage() {
  await requireRole("admin");
  await runTutorCoverReminders();
  const [creditData, coverData] = await Promise.all([
    getCreditsOverview(),
    getAdminCoverOverview(),
  ]);
  const { credits, creditsTruncated, usage } = creditData;

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Reschedules"
        title="Reschedules & tutor cover"
      />

      <div id="tutor-cover" className="scroll-mt-20 space-y-6">
        <Card className="rise" accent={coverData.pendingLeaves.length ? "bad" : "good"}>
          <CardHead
            title="Extended leave approvals"
            eyebrow="Admin action required"
            action={
              <Pill tone={coverData.pendingLeaves.length ? "bad" : "good"}>
                {coverData.pendingLeaves.length} pending
              </Pill>
            }
          />
          {coverData.pendingLeaves.length === 0 ? (
            <Empty>No extended leave requests need approval.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {coverData.pendingLeaves.map((leave) => (
                <li
                  key={leave.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-extrabold text-ink">
                        {leave.tutorFirst} {leave.tutorLast}
                      </span>
                      <Pill tone="warn">
                        {formatDateLong(leave.startDate)}–{formatDateLong(leave.endDate)}
                      </Pill>
                    </div>
                    <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-muted">
                      {leave.reason}
                    </p>
                  </div>
                  <LeaveDecisionButtons leaveRequestId={leave.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="rise" accent={coverData.board.some((row) => row.status === "open") ? "warn" : "good"}>
          <CardHead
            title="Tutor cover notice board"
            eyebrow="Upcoming classes"
            action={
              <Pill tone={coverData.board.some((row) => row.status === "open") ? "warn" : "good"}>
                {coverData.board.filter((row) => row.status === "open").length} open
              </Pill>
            }
          />
          {coverData.board.length === 0 ? (
            <Empty>No upcoming cover requests.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {coverData.board.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-extrabold text-ink">
                        {tutorCoverClassLabel(row.subjectName, row.className)}
                      </span>
                      <Pill
                        tone={
                          row.status === "claimed"
                            ? "good"
                            : row.hoursRemaining <= 48
                              ? "bad"
                              : "warn"
                        }
                      >
                        {row.status === "claimed"
                          ? "Covered"
                          : row.hoursRemaining <= 24
                            ? "Under 24h"
                            : row.hoursRemaining <= 48
                              ? "Under 48h"
                              : "Needs cover"}
                      </Pill>
                    </div>
                    <div className="mt-1 text-[12px] font-semibold text-ink-soft">
                      {tutorCoverDateLabel(row.date, row.className)} · {formatTime(row.startTime)}–{formatTime(row.endTime)} · {row.location ?? "Location TBC"}
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {row.originalTutorFirst} {row.originalTutorLast}: {row.reason}
                    </p>
                    {row.status === "claimed" && (
                      <p className="mt-1 text-[12px] font-bold text-good">
                        Covered by {row.replacementTutorFirst} {row.replacementTutorLast}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AssignCoverForm
                      coverRequestId={row.id}
                      originalTutorId={row.originalTutorId}
                      currentReplacementTutorId={row.replacementTutorId}
                      tutors={coverData.tutors}
                    />
                    {row.status === "claimed" && (
                      <ReopenCoverButton coverRequestId={row.id} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <CardBody className="border-t border-line bg-surface-2/60 py-3 text-[11px] text-muted">
            All active tutors may claim a shift. The system blocks timetable clashes and notifies admin whenever cover is posted, claimed, or released.
          </CardBody>
        </Card>
      </div>

      <Card className="rise">
        <CardHead
          title="Class credits"
          eyebrow="Read-only"
          action={
            <Pill tone="default">
              {creditsTruncated ? `${credits.length}+` : credits.length}
            </Pill>
          }
        />
        {creditsTruncated && (
          <p className="px-5 py-2 text-[12px] text-muted border-b border-line bg-surface-2/60">
            Showing the {credits.length} most recent credits - older credits
            are not listed.
          </p>
        )}
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
                      {u.cancellationsUsed} of {u.cancellationCap}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-ink-soft">
                      {u.reschedulesUsed} of {u.rescheduleCap}
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
