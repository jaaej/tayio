import Link from "next/link";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead, SectionHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { StatChip } from "@/components/student/stat-chip";
import { formatDateLong, formatTime, isoDate } from "@/lib/format";
import { getTutorAttendanceOverview, requireTutor } from "../_data";

export default async function TutorAttendancePage() {
  const tutor = await requireTutor();
  const rows = await getTutorAttendanceOverview(tutor.id, 28, 7);

  const todayIso = isoDate(new Date());

  // Bucket lessons into today / upcoming / past so each gets its own card
  // with a clear tutor next-action ("mark today's lesson now" beats "scroll
  // through 30 rows to find it").
  const today = rows.filter((l) => l.date === todayIso);
  const upcoming = rows.filter((l) => l.date > todayIso);
  const past = rows.filter((l) => l.date < todayIso);

  const unmarkedPast = past.filter(
    (l) => l.marked === 0 || (l.roster > 0 && l.marked < l.roster),
  );
  const fullyMarkedPast = past.filter(
    (l) => l.roster > 0 && l.marked >= l.roster,
  );

  const totals = past.reduce(
    (acc, l) => {
      acc.present += l.present;
      acc.late += l.late;
      acc.absent += l.absent;
      acc.marked += l.marked;
      return acc;
    },
    { present: 0, late: 0, absent: 0, marked: 0 },
  );
  const attendanceRate =
    totals.marked > 0
      ? Math.round(((totals.present + totals.late) / totals.marked) * 100)
      : null;

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Attendance"
        title="Mark + review"
        sub={`Last 4 weeks · ${past.length} past lesson${past.length === 1 ? "" : "s"} · ${unmarkedPast.length} still need marking`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatChip
          icon="✓"
          hue={
            attendanceRate === null
              ? "brand"
              : attendanceRate >= 90
                ? "mint"
                : attendanceRate >= 75
                  ? "sun"
                  : "coral"
          }
          value={attendanceRate === null ? "—" : `${attendanceRate}%`}
          label="Avg attendance"
        />
        <StatChip
          icon="📅"
          hue="sky"
          value={today.length}
          label="Today's lessons"
        />
        <StatChip
          icon="⚠️"
          hue={unmarkedPast.length > 0 ? "coral" : "mint"}
          value={unmarkedPast.length}
          label="Past unmarked"
        />
        <StatChip
          icon="🎯"
          hue="grape"
          value={fullyMarkedPast.length}
          label="Past fully marked"
        />
      </div>

      {today.length > 0 && (
        <Card className="overflow-hidden border-brand-300">
          <CardHead title="Today" action={`${today.length} lesson${today.length === 1 ? "" : "s"}`} />
          <CardBody tight>
            <ul className="divide-y divide-line">
              {today.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {upcoming.length > 0 && (
        <div>
          <SectionHead title="Upcoming · next 7 days" />
          <Card className="overflow-hidden">
            <CardBody tight>
              <ul className="divide-y divide-line">
                {upcoming.map((l) => (
                  <LessonRow key={l.id} lesson={l} />
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}

      <div>
        <SectionHead
          title="Past lessons"
          actionHref="/tutor/classes"
          actionLabel="By class →"
        />
        {past.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-sm text-muted text-center py-2">
                No past lessons in the last 4 weeks.
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardBody tight>
              <ul className="divide-y divide-line">
                {past.map((l) => (
                  <LessonRow key={l.id} lesson={l} />
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

type LessonRowProps = {
  lesson: Awaited<
    ReturnType<typeof getTutorAttendanceOverview>
  >[number];
};

function LessonRow({ lesson: l }: LessonRowProps) {
  const fullyMarked = l.roster > 0 && l.marked >= l.roster;
  const partial = l.marked > 0 && l.marked < l.roster;
  const unmarked = l.marked === 0;

  const statusPill = fullyMarked ? (
    <Pill tone="good">Marked</Pill>
  ) : partial ? (
    <Pill tone="warn">
      {l.marked}/{l.roster} marked
    </Pill>
  ) : (
    <Pill tone="neutral">Not started</Pill>
  );

  return (
    <li>
      <Link
        href={`/tutor/lessons/${l.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
      >
        <div className="w-24 shrink-0">
          <div className="text-[12px] font-bold text-ink tabular-nums">
            {formatDateLong(l.date).split(",")[0]}
          </div>
          <div className="text-[11px] text-muted tabular-nums mt-0.5">
            {formatTime(l.startTime)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-ink truncate">
            {l.className}
          </div>
          <div className="text-[11px] text-muted truncate mt-0.5">
            {l.subjectName} · {l.roster} enrolled
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {statusPill}
          {l.marked > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] tabular-nums">
              {l.present > 0 && (
                <span className="text-good font-bold">{l.present}P</span>
              )}
              {l.late > 0 && (
                <span className="text-warn font-bold">{l.late}L</span>
              )}
              {l.absent > 0 && (
                <span className="text-bad font-bold">{l.absent}A</span>
              )}
            </div>
          )}
        </div>
        <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600 shrink-0 ml-2">
          {unmarked ? "Mark →" : fullyMarked ? "Edit →" : "Continue →"}
        </span>
      </Link>
    </li>
  );
}
