import Link from "next/link";
import {
  buttonVariants,
  Empty,
  GlassPanel,
  PageHeader,
  Pill,
} from "@/components/admin/ui";
import { CoverBoardColumn, CoverCard } from "@/components/cover/cover-board";
import { requireRole } from "@/lib/auth";
import type { CoverBoardRow } from "@/lib/tutor-cover";
import { CoverActionButton, WithdrawLeaveButton } from "./_components/cover-controls";
import type { CoverFit } from "./_lib/fit";
import {
  LEAVE_STATUS,
  coverUrgencyLabel,
  leaveDetail,
  leaveRangeLabel,
} from "./_lib/labels";
import { getTutorCoverBoard } from "./_lib/queries";

export const dynamic = "force-dynamic";

const FIT_STATE: Record<CoverFit, { text: string; tone: "good" | "warn" | "bad" }> = {
  free: { text: "You’re free then", tone: "good" },
  outside: { text: "Outside your hours", tone: "warn" },
  clash: { text: "You have a class then", tone: "bad" },
};

function tutorName(first: string | null, last: string | null) {
  return `${first ?? ""} ${last ?? ""}`.trim();
}

function cardProps(row: CoverBoardRow) {
  return {
    subjectName: row.subjectName,
    className: row.className,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
  };
}

export default async function TutorCoverPage() {
  const user = await requireRole("tutor");
  const board = await getTutorCoverBoard(user.id);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cover board"
        actions={
          <Link
            href="/tutor/timetable?panel=leave"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            Report absence or leave
          </Link>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-start gap-4">
        <CoverBoardColumn
          id="cover-needed"
          title="Needs cover"
          dotClassName="bg-[#E8890C]"
          count={board.needsCover.length}
          empty="No classes need cover."
        >
          {board.needsCover.map((row) => {
            const fit = board.fits.get(row.id) ?? "outside";
            return (
              <CoverCard
                key={row.id}
                {...cardProps(row)}
                reason={`${tutorName(row.originalTutorFirst, row.originalTutorLast)}: ${row.reason}`}
                urgency={coverUrgencyLabel(row.hoursRemaining)}
                state={FIT_STATE[fit]}
                // The claim is refused on a clash, so no button is offered.
                actions={
                  fit === "clash" ? undefined : (
                    <CoverActionButton coverRequestId={row.id} mode="claim" />
                  )
                }
              />
            );
          })}
        </CoverBoardColumn>

        <CoverBoardColumn
          id="cover-mine"
          title="You’re covering"
          dotClassName="bg-[#3B4FD8]"
          count={board.covering.length}
          empty="You’re not covering any classes."
        >
          {board.covering.map((row) => (
            <CoverCard
              key={row.id}
              {...cardProps(row)}
              reason={`For ${tutorName(row.originalTutorFirst, row.originalTutorLast)}: ${row.reason}`}
              state={{ text: "On your timetable", tone: "info" }}
              actions={<CoverActionButton coverRequestId={row.id} mode="release" />}
            />
          ))}
        </CoverBoardColumn>

        <CoverBoardColumn
          id="cover-requests"
          title="Your requests"
          dotClassName="bg-[#16A34A]"
          count={board.requests.length}
          empty="You haven’t posted any classes."
        >
          {board.requests.map((row) => (
            <CoverCard
              key={row.id}
              {...cardProps(row)}
              reason={row.reason}
              urgency={
                row.status === "open" ? coverUrgencyLabel(row.hoursRemaining) : null
              }
              state={
                row.status === "claimed"
                  ? {
                      text: `Covered by ${tutorName(row.replacementTutorFirst, row.replacementTutorLast)}`,
                      tone: "good",
                    }
                  : { text: "Waiting for a tutor", tone: "warn" }
              }
            />
          ))}
        </CoverBoardColumn>
      </div>

      <GlassPanel
        title="Your extended leave"
        titleId="leave-heading"
        meta="Once approved, every affected class is posted for cover"
      >
        {board.leave.length === 0 ? (
          <Empty>No leave requests.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {board.leave.map((leave) => {
              const status = LEAVE_STATUS[leave.status];
              return (
                <li
                  key={leave.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="flex min-w-0 flex-[1_1_260px] flex-col">
                    <span className="text-[14px] font-bold text-ink">
                      {leaveRangeLabel(leave.startDate, leave.endDate)}
                    </span>
                    <span className="text-[12px] text-muted">{leaveDetail(leave)}</span>
                  </div>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  {leave.status === "pending" && (
                    <WithdrawLeaveButton leaveRequestId={leave.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
