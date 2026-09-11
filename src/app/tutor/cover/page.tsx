import Link from "next/link";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { getTutorCoverPageData, type CoverBoardRow } from "@/lib/tutor-cover";
import {
  tutorCoverClassLabel,
  tutorCoverDateLabel,
} from "@/lib/tutor-cover-rules";
import { CoverActionButton } from "./_components/cover-controls";

const LEAVE_LABEL = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Declined",
  cancelled: "Cancelled",
} as const;

export default async function TutorCoverPage() {
  const user = await requireRole("tutor");
  const data = await getTutorCoverPageData(user.id);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Schedule"
        title="Tutor cover board"
        sub="Pick up a class that needs cover and manage the shifts you have claimed."
        actions={
          <Link
            href="/tutor/timetable?panel=leave"
            className="inline-flex min-h-10 items-center rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700"
          >
            Report absence or leave
          </Link>
        }
      />

      <Card>
        <CardHead
          title="Classes needing cover"
          action={<Pill tone={data.open.length ? "warn" : "good"}>{data.open.length} open</Pill>}
        />
        {data.open.length === 0 ? (
          <CardBody>
            <p className="py-4 text-center text-[13px] text-muted">
              Every posted class is covered.
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {data.open.map((row) => (
              <CoverRow
                key={row.id}
                row={row}
                action={
                  row.originalTutorId === user.id ? (
                    <span className="text-[11px] font-bold text-muted">Your class</span>
                  ) : (
                    <CoverActionButton coverRequestId={row.id} mode="claim" />
                  )
                }
              />
            ))}
          </ul>
        )}
      </Card>

      {data.claimedByMe.length > 0 && (
        <Card>
          <CardHead
            title="Cover I’m teaching"
            action={<Pill tone="info">{data.claimedByMe.length}</Pill>}
          />
          <ul className="divide-y divide-line">
            {data.claimedByMe.map((row) => (
              <CoverRow
                key={row.id}
                row={row}
                action={<CoverActionButton coverRequestId={row.id} mode="release" />}
              />
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHead title="My class cover requests" />
          {data.requestedByMe.length === 0 ? (
            <CardBody><p className="text-[13px] text-muted">No active class requests.</p></CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {data.requestedByMe.map((row) => (
                <CoverRow key={row.id} row={row} compact />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="My extended leave" />
          {data.leaveRequests.length === 0 ? (
            <CardBody><p className="text-[13px] text-muted">No leave requests.</p></CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {data.leaveRequests.map((leave) => (
                <li key={leave.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div>
                    <div className="text-[13px] font-bold text-ink">
                      {formatDateLong(leave.startDate)}–{formatDateLong(leave.endDate)}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-muted">{leave.reason}</p>
                  </div>
                  <Pill
                    tone={
                      leave.status === "approved"
                        ? "good"
                        : leave.status === "pending"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {LEAVE_LABEL[leave.status]}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function CoverRow({
  row,
  action,
  compact = false,
}: {
  row: CoverBoardRow;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  const urgent = row.hoursRemaining <= 48;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-extrabold text-ink">
            {tutorCoverClassLabel(row.subjectName, row.className)}
          </span>
          {urgent && row.status === "open" && <Pill tone="bad">Urgent</Pill>}
          {row.status === "claimed" && <Pill tone="good">Covered</Pill>}
        </div>
        <div className="mt-0.5 text-[12px] font-semibold text-ink-soft">
          {tutorCoverDateLabel(row.date, row.className)} · {formatTime(row.startTime)}–{formatTime(row.endTime)}
          {!compact && ` · ${row.location ?? "Location TBC"}`}
        </div>
        <p className="mt-1 text-[12px] text-muted">
          {compact
            ? row.replacementTutorId
              ? `Covered by ${row.replacementTutorFirst} ${row.replacementTutorLast}`
              : "Waiting for another tutor"
            : `${row.originalTutorFirst} ${row.originalTutorLast}: ${row.reason}`}
        </p>
      </div>
      {action}
    </li>
  );
}
