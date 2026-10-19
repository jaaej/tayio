import Link from "next/link";
import { buttonVariants, PageHeader } from "@/components/admin/ui";
import { CoverBoardColumn, CoverCard } from "@/components/cover/cover-board";
import { requireRole } from "@/lib/auth";
import type { CoverBoardRow } from "@/lib/tutor-cover";
import { CoverActionButton } from "./_components/cover-controls";
import type { CoverFit } from "./_lib/fit";
import { coverUrgencyLabel, handoverLine, TIME_AWAY_ACTION } from "./_lib/labels";
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
    subjectColor: row.subjectColor,
    className: row.className,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
  };
}

/**
 * Other tutors' classes that need cover and the ones you are covering. Your
 * own posted classes and leave live under Time away on Schedule &
 * availability. A tutor's reason for time away is private to them and
 * admins: the cards show only the handover note written for the cover.
 */
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
            {TIME_AWAY_ACTION}
          </Link>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start gap-4">
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
                reason={handoverLine(
                  `From ${tutorName(row.originalTutorFirst, row.originalTutorLast)}`,
                  row.handoverNote,
                )}
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
              reason={handoverLine(
                `For ${tutorName(row.originalTutorFirst, row.originalTutorLast)}`,
                row.handoverNote,
              )}
              state={{ text: "On your schedule", tone: "info" }}
              actions={<CoverActionButton coverRequestId={row.id} mode="release" />}
            />
          ))}
        </CoverBoardColumn>
      </div>
    </div>
  );
}
