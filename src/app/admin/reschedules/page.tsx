import { CancelLessonButton } from "@/components/lessons/cancel-lesson-button";
import type { CreditGrantReason } from "@/db/schema";
import Link from "next/link";
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
import { CoverBoardColumn, CoverCard } from "@/components/cover/cover-board";
import { RescheduleRequestList } from "@/components/reschedule/request-list";
import { getCreditsOverview } from "@/app/admin/_lib/queries";
import { ClassMoveRequestCard } from "@/app/admin/_components/class-move-request-card";
import { getPendingClassMoves } from "@/lib/class-moves";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatDateShort, formatTime } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { type CreditStatus } from "@/lib/reschedule-credits";
import { listPendingRequests } from "@/lib/reschedule";
import {
  getAdminCoverOverview,
  getLeaveAffectedLessonCounts,
  runTutorCoverReminders,
  type CoverBoardRow,
} from "@/lib/tutor-cover";
import { melbourneDate, tutorCoverClassLabel } from "@/lib/tutor-cover-rules";
import { cn } from "@/lib/utils";
import {
  AssignCoverForm,
  OutsideCoverForm,
  LeaveDecisionButtons,
  ReopenCoverButton,
} from "./_components/cover-controls";
import {
  COVER_COLUMNS,
  COVER_COLUMN_LABEL,
  bucketCoverBoard,
  startedWithoutCover,
  isInsideNoticeWindow,
  type CoverColumn,
} from "./_lib/cover-columns";
import { getRecentLeaveDecisions } from "./_lib/queries";

export const dynamic = "force-dynamic";

const TABS = ["cover", "leave", "moves", "credits", "usage"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  cover: "Cover board",
  leave: "Leave requests",
  moves: "Class moves",
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

const REASON_LABEL: Record<CreditGrantReason, string> = {
  cancellation: "Cancellation",
  reschedule_no_slot: "No slot available",
  admin_grant: "Admin grant",
  lesson_cancelled: "Lesson cancelled by Taiyo",
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
    : `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;
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
  const [coverData, pendingRequests, pendingMoves, creditData, recentLeave] = await Promise.all([
    getAdminCoverOverview(now),
    // Family reschedules have moved lessons directly since 2026-08-01, so
    // nothing creates a pending request any more (`createRescheduleRequest`
    // has no caller) and none is counted. One left over from before still
    // shows here so it can be decided rather than stranded.
    listPendingRequests({}),
    getPendingClassMoves(),
    tab === "credits" || tab === "usage" ? getCreditsOverview() : null,
    tab === "leave" ? getRecentLeaveDecisions() : null,
  ]);
  const { pendingLeaves, board, tutors } = coverData;
  const affected = tab === "leave"
    ? await getLeaveAffectedLessonCounts(pendingLeaves, now)
    : new Map<string, number>();
  const columns = bucketCoverBoard(board, now);
  const openCount = columns.urgent.length + columns.open.length;

  const tabCount: Partial<Record<Tab, number>> = {
    cover: openCount,
    leave: pendingLeaves.length,
    moves: pendingMoves.length,
  };
  const tabs = TABS.map((key) => ({
    label: TAB_LABEL[key],
    href: key === "cover" ? "/admin/reschedules" : `/admin/reschedules?tab=${key}`,
    active: tab === key,
    count: tabCount[key] || undefined,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cover & leave"
        actions={
          // Wraps to two rows on a phone rather than hiding a tab off-screen.
          <SegmentedLinks label="Section" items={tabs} className="flex-wrap" />
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
          {board.length === 0 ? (
            <GlassPanel title="Cover board" titleId="cover-board-heading">
              <Empty>No upcoming cover requests.</Empty>
            </GlassPanel>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-start gap-4">
              {COVER_COLUMNS.map((column) => (
                <CoverBoardColumn
                  key={column}
                  id={`cover-${column}`}
                  title={COVER_COLUMN_LABEL[column]}
                  dotClassName={COLUMN_DOT[column]}
                  count={columns[column].length}
                  empty={COLUMN_EMPTY[column]}
                >
                  {columns[column].map((row) => (
                    <AdminCoverCard key={row.id} row={row} now={now} tutors={tutors} />
                  ))}
                </CoverBoardColumn>
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

      {tab === "moves" && (
        <GlassPanel
          title="Permanent class moves"
          titleId="class-moves-heading"
          meta={pendingMoves.length > 0 ? pendingMoves.length : undefined}
          bodyClassName={pendingMoves.length > 0 ? "p-3" : undefined}
        >
          {pendingMoves.length === 0 ? (
            <Empty>No class move requests waiting.</Empty>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3">
              {pendingMoves.map((request) => (
                <ClassMoveRequestCard key={request.id} request={request} showStudent />
              ))}
            </div>
          )}
        </GlassPanel>
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
                        <StudentCreditsLink studentId={c.studentId}>
                          {c.studentFirst} {c.studentLast}
                        </StudentCreditsLink>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">
                        <span className="inline-flex items-center gap-2">
                          <SubjectDot subject={c.subjectName} color={c.subjectColor} />
                          {c.subjectName}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">
                        <span className="whitespace-nowrap">{REASON_LABEL[c.grantReason]}</span>
                        {c.requestReason && (
                          <span className="mt-0.5 block max-w-[260px] text-[12px] text-muted">
                            &ldquo;{c.requestReason}&rdquo;
                          </span>
                        )}
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
                        <StudentCreditsLink studentId={u.studentId}>
                          {u.studentFirst} {u.studentLast}
                        </StudentCreditsLink>
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

/** The student's Credits tab, where a credit is granted or a lesson moved. */
function StudentCreditsLink({
  studentId,
  children,
}: {
  studentId: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/admin/users/${studentId}?tab=credits`}
      className="text-ink hover:text-brand-700 hover:underline"
    >
      {children}
    </Link>
  );
}

function AdminCoverCard({
  row,
  now,
  tutors,
}: {
  row: CoverBoardRow;
  now: Date;
  tutors: { id: string; firstName: string; lastName: string }[];
}) {
  const covered = row.status === "claimed";
  const outside = row.status === "external";
  const started = startedWithoutCover(row, now);
  return (
    <CoverCard
      subjectName={row.subjectName}
      subjectColor={row.subjectColor}
      className={row.className}
      date={row.date}
      startTime={row.startTime}
      endTime={row.endTime}
      location={row.location}
      reason={[
        `${row.originalTutorFirst} ${row.originalTutorLast}: ${row.reason}`,
        row.handoverNote?.trim() && `Handover: ${row.handoverNote.trim()}`,
      ]
        .filter(Boolean)
        .join(" · ")}
      urgency={started ? "Started without cover" : isInsideNoticeWindow(row, now) ? "Under 48h" : null}
      state={
        covered
          ? {
              text: `Covered by ${row.replacementTutorFirst} ${row.replacementTutorLast}`,
              tone: "good",
            }
          : outside
            ? {
                text: row.externalTutorName
                  ? `Covered by ${row.externalTutorName} (not on the portal)`
                  : "Covered by someone not on the portal",
                tone: "good",
              }
            : null
      }
      actions={
        <div className="flex w-full flex-col gap-2.5">
          {/* A portal tutor can take it until it starts. */}
          {!outside && !started && (
            <AssignCoverForm
              coverRequestId={row.id}
              originalTutorId={row.originalTutorId}
              currentReplacementTutorId={row.replacementTutorId}
              tutors={tutors}
            />
          )}
          {(covered || outside) && row.hoursRemaining > 0 && <ReopenCoverButton coverRequestId={row.id} />}
          {!covered && !outside && (
            <>
              <OutsideCoverForm coverRequestId={row.id} />
              <CancelLessonButton
                lessonId={row.lessonId}
                variant="card"
                subject={{
                  label: [
                    tutorCoverClassLabel(row.subjectName, row.className),
                    formatDateLong(row.date),
                    formatTime(row.startTime),
                  ].join(" · "),
                  dot: subjectTone(row.subjectName, row.subjectColor).dot,
                }}
              />
            </>
          )}
        </div>
      }
    />
  );
}
