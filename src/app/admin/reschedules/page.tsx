import {
  Avatar,
  Empty,
  GlassPanel,
  PageHeader,
  Pill,
  SegmentedLinks,
  SubjectDot,
  type PillTone,
} from "@/components/admin/ui";
import { RescheduleRequestList } from "@/components/reschedule/request-list";
import { getCreditsOverview } from "@/app/admin/_lib/queries";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatDateShort, formatTime } from "@/lib/format";
import { type CreditStatus } from "@/lib/reschedule-credits";
import { listPendingRequests } from "@/lib/reschedule";
import {
  getAdminCoverOverview,
  runTutorCoverReminders,
  type CoverBoardRow,
} from "@/lib/tutor-cover";
import {
  melbourneDate,
  tutorCoverClassLabel,
  tutorCoverDateLabel,
} from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import {
  AssignCoverForm,
  LeaveDecisionButtons,
  ReopenCoverButton,
} from "./_components/cover-controls";
import {
  COVER_COLUMNS,
  COVER_COLUMN_LABEL,
  bucketCoverBoard,
  isInsideNoticeWindow,
  type CoverColumn,
} from "./_lib/cover-columns";
import {
  getLeaveAffectedLessonCounts,
  getRecentLeaveDecisions,
} from "./_lib/queries";

export const dynamic = "force-dynamic";

const TABS = ["cover", "leave", "credits", "usage"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  cover: "Cover board",
  leave: "Leave requests",
  credits: "Class credits",
  usage: "Term usage",
};

const COLUMN_DOT: Record<CoverColumn, string> = {
  urgent: "bg-[#D92D20]",
  open: "bg-[#E8890C]",
  covered: "bg-[#16A34A]",
};

const COLUMN_EMPTY: Record<CoverColumn, string> = {
  urgent: "Nothing urgent.",
  open: "No classes waiting for cover.",
  covered: "No covered classes yet.",
};

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

const LEAVE_TONE: Record<string, PillTone> = {
  approved: "good",
  rejected: "bad",
  cancelled: "default",
};

const LEAVE_LABEL: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const TH = "px-5 py-2.5 text-[12px] font-bold text-muted";

function leaveRange(startDate: string, endDate: string) {
  return startDate === endDate
    ? formatDateLong(startDate)
    : `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`;
}

function classCount(count: number) {
  return `${count} ${count === 1 ? "class" : "classes"}`;
}

export default async function AdminReschedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("admin");
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "cover";

  await runTutorCoverReminders();
  const now = new Date();
  const [coverData, pendingRequests, creditData, recentLeave] = await Promise.all([
    getAdminCoverOverview(now),
    // The student self-serve approval queue was retired on 2026-08-01, but any
    // request still pending counts toward the sidebar badge, so it must be
    // decidable here rather than silently inflating the count.
    listPendingRequests({}),
    tab === "credits" || tab === "usage" ? getCreditsOverview() : null,
    tab === "leave" ? getRecentLeaveDecisions() : null,
  ]);
  const { pendingLeaves, board, tutors } = coverData;
  const affected = await getLeaveAffectedLessonCounts(pendingLeaves, now);
  const columns = bucketCoverBoard(board, now);
  const openCount = columns.urgent.length + columns.open.length;

  const tabs = TABS.map((key) => ({
    label: TAB_LABEL[key],
    href: key === "cover" ? "/admin/reschedules" : `/admin/reschedules?tab=${key}`,
    active: tab === key,
    count:
      key === "cover" && openCount > 0
        ? openCount
        : key === "leave" && pendingLeaves.length > 0
          ? pendingLeaves.length
          : undefined,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reschedules & cover"
        actions={
          <div className="max-w-full overflow-x-auto">
            <SegmentedLinks label="Section" items={tabs} />
          </div>
        }
      />

      {pendingRequests.length > 0 && (
        <GlassPanel
          title="Reschedule requests"
          titleId="reschedule-requests-heading"
          meta={pendingRequests.length}
          bodyClassName="p-3"
        >
          <RescheduleRequestList
            requests={pendingRequests.map((request) => ({
              id: request.id,
              studentName: request.studentName,
              subjectName: request.subjectName,
              fromLabel: request.fromLabel,
              toLabel: request.toLabel,
              reason: request.reason,
            }))}
          />
        </GlassPanel>
      )}

      {tab === "cover" && (
        <div id="tutor-cover" className="flex scroll-mt-5 flex-col gap-5">
          {pendingLeaves.map((leave) => {
            const name = `${leave.tutorFirst} ${leave.tutorLast}`.trim();
            const count = affected.get(leave.id) ?? 0;
            return (
              <div key={leave.id} className="glass rounded-[20px] p-1.5">
                <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={name} size={34} className="bg-good-bg text-good" />
                  <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-0.5">
                    <p className="text-[14px] text-ink">
                      <strong className="font-extrabold">{name}</strong> requested leave{" "}
                      <strong className="font-extrabold">
                        {leaveRange(leave.startDate, leave.endDate)}
                      </strong>
                      {count > 0 && <> · {classCount(count)} affected</>}
                    </p>
                    <p className="text-[12px] text-muted">{leave.reason}</p>
                  </div>
                  <LeaveDecisionButtons leaveRequestId={leave.id} />
                </div>
              </div>
            );
          })}

          {board.length === 0 ? (
            <GlassPanel title="Cover board" titleId="cover-board-heading">
              <Empty>No upcoming cover requests.</Empty>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-start gap-4">
              {COVER_COLUMNS.map((column) => (
                <section
                  key={column}
                  aria-labelledby={`cover-${column}-heading`}
                  className="glass flex min-w-0 flex-col rounded-[24px] p-1.5"
                >
                  <div className="flex items-center gap-2 pb-2.5 pl-3 pr-2 pt-2">
                    <span
                      aria-hidden
                      className={cn("h-[9px] w-[9px] rounded-full", COLUMN_DOT[column])}
                    />
                    <h2
                      id={`cover-${column}-heading`}
                      className="text-[15px] font-extrabold text-ink"
                    >
                      {COVER_COLUMN_LABEL[column]}
                    </h2>
                    <span className="text-[13px] font-bold tabular-nums text-ink-soft">
                      {columns[column].length}
                    </span>
                  </div>
                  {columns[column].length === 0 ? (
                    <div className="panel">
                      <Empty className="py-6">{COLUMN_EMPTY[column]}</Empty>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {columns[column].map((row) => (
                        <CoverCard key={row.id} row={row} now={now} tutors={tutors} />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "leave" && (
        <>
          <GlassPanel
            title="Waiting for approval"
            titleId="leave-pending-heading"
            meta={pendingLeaves.length > 0 ? pendingLeaves.length : undefined}
          >
            {pendingLeaves.length === 0 ? (
              <Empty>No leave requests need approval.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {pendingLeaves.map((leave) => {
                  const name = `${leave.tutorFirst} ${leave.tutorLast}`.trim();
                  const count = affected.get(leave.id) ?? 0;
                  return (
                    <li
                      key={leave.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5"
                    >
                      <Avatar name={name} size={34} />
                      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-extrabold text-ink">{name}</span>
                          <Pill tone="warn">{leaveRange(leave.startDate, leave.endDate)}</Pill>
                          {count > 0 && (
                            <span className="text-[12px] font-semibold text-ink-soft">
                              {classCount(count)} affected
                            </span>
                          )}
                        </div>
                        <p className="max-w-3xl text-[12px] leading-relaxed text-muted">
                          {leave.reason}
                        </p>
                      </div>
                      <LeaveDecisionButtons leaveRequestId={leave.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassPanel>

          <GlassPanel title="Recent decisions" titleId="leave-recent-heading">
            {!recentLeave || recentLeave.length === 0 ? (
              <Empty>No leave requests have been decided yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {recentLeave.map((leave) => {
                  const name = `${leave.tutorFirst} ${leave.tutorLast}`.trim();
                  const decided = leave.decidedAt ?? leave.updatedAt;
                  return (
                    <li
                      key={leave.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5"
                    >
                      <span className="text-[14px] font-bold text-ink">{name}</span>
                      <span className="text-[13px] text-ink-soft">
                        {leaveRange(leave.startDate, leave.endDate)}
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-[12px] text-muted tabular-nums">
                          {formatDateShort(melbourneDate(decided))}
                        </span>
                        <Pill tone={LEAVE_TONE[leave.status] ?? "default"}>
                          {LEAVE_LABEL[leave.status] ?? leave.status}
                        </Pill>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassPanel>
        </>
      )}

      {tab === "credits" && creditData && (
        <GlassPanel
          title="Class credits"
          titleId="credits-heading"
          meta={
            creditData.creditsTruncated
              ? `${creditData.credits.length}+`
              : creditData.credits.length
          }
        >
          {creditData.creditsTruncated && (
            <p className="border-b border-line bg-surface-2 px-5 py-2 text-[12px] text-muted">
              Only the {creditData.credits.length} most recent credits are listed.
            </p>
          )}
          {creditData.credits.length === 0 ? (
            <Empty>No class credits yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className={TH}>Student</th>
                    <th className={TH}>Subject</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Reason</th>
                    <th className={TH}>Granted from</th>
                    <th className={TH}>Redeemed on</th>
                    <th className={TH}>Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {creditData.credits.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-surface-2">
                      <td className="whitespace-nowrap px-5 py-3 font-bold text-ink">
                        {c.studentFirst} {c.studentLast}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                        <span className="inline-flex items-center gap-2">
                          <SubjectDot subject={c.subjectName} />
                          {c.subjectName}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                        {REASON_LABEL[c.grantReason]}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                        {c.grantedFromLabel ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                        {c.redeemedOnLabel ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink-soft">
                        {formatDateLong(c.expiresAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      )}

      {tab === "usage" && creditData && (
        <GlassPanel
          title="This term's usage"
          titleId="usage-heading"
          meta={creditData.usage.length}
        >
          {creditData.usage.length === 0 ? (
            <Empty>No usage this term.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className={TH}>Student</th>
                    <th className={cn(TH, "text-right")}>Cancellations used</th>
                    <th className={cn(TH, "text-right")}>Reschedules used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {creditData.usage.map((u) => (
                    <tr key={u.studentId} className="transition-colors hover:bg-surface-2">
                      <td className="whitespace-nowrap px-5 py-3 font-bold text-ink">
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
        </GlassPanel>
      )}
    </div>
  );
}

function CoverCard({
  row,
  now,
  tutors,
}: {
  row: CoverBoardRow;
  now: Date;
  tutors: { id: string; firstName: string; lastName: string }[];
}) {
  const covered = row.status === "claimed";
  return (
    <li className="panel flex flex-col gap-2.5 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <SubjectDot subject={row.subjectName} className="h-2 w-2" />
        <span className="min-w-0 flex-1 text-[14px] font-extrabold text-ink">
          {tutorCoverClassLabel(row.subjectName, row.className)}
        </span>
        {isInsideNoticeWindow(row, now) && <Pill tone="bad">Under 48h</Pill>}
      </div>
      <div className="flex flex-col gap-0.5 text-[13px]">
        <span className="font-bold text-ink">
          {tutorCoverDateLabel(row.date, row.className)} · {formatTime(row.startTime)} –{" "}
          {formatTime(row.endTime)}
        </span>
        <span className="text-muted">{row.location ?? "Location TBC"}</span>
      </div>
      <p className="rounded-[10px] bg-surface-2 px-2.5 py-2 text-[12px] text-ink-soft">
        {row.originalTutorFirst} {row.originalTutorLast}: {row.reason}
      </p>
      {covered && (
        <p className="text-[12px] font-bold text-good">
          Covered by {row.replacementTutorFirst} {row.replacementTutorLast}
        </p>
      )}
      <AssignCoverForm
        coverRequestId={row.id}
        originalTutorId={row.originalTutorId}
        currentReplacementTutorId={row.replacementTutorId}
        tutors={tutors}
      />
      {covered && <ReopenCoverButton coverRequestId={row.id} />}
    </li>
  );
}
