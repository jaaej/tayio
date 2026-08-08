import Link from "next/link";
import { Card, CardBody, CardHead } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { formatDateLong, formatTime, isoDate } from "@/lib/format";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { getTutorAttendanceOverview, requireTutor } from "../_data";

export default async function TutorAttendancePage() {
  const tutor = await requireTutor();
  const rows = await getTutorAttendanceOverview(tutor.id, 28, 7);

  const todayIso = isoDate(new Date());

  const today = rows.filter((l) => l.date === todayIso);
  // Everything except today (upcoming + past), already date-desc from the query.
  const rest = rows.filter((l) => l.date !== todayIso);
  const past = rows.filter((l) => l.date < todayIso);
  const unmarkedPast = past.filter(
    (l) => l.marked === 0 || (l.roster > 0 && l.marked < l.roster),
  );

  // Group the non-today lessons by class. First-appearance order means the
  // class with the most recent lesson lands on top (rows arrive date-desc).
  const classGroups: Array<{
    classId: string;
    className: string;
    subjectName: string;
    lessons: typeof rows;
  }> = [];
  const classIndex = new Map<string, number>();
  for (const l of rest) {
    let idx = classIndex.get(l.classId);
    if (idx === undefined) {
      idx = classGroups.length;
      classIndex.set(l.classId, idx);
      classGroups.push({
        classId: l.classId,
        className: l.className,
        subjectName: l.subjectName,
        lessons: [],
      });
    }
    classGroups[idx].lessons.push(l);
  }

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Attendance"
        title="Mark + review"
      />

      {today.length > 0 && (
        <Card className="overflow-hidden border-brand-300">
          <CardHead
            title="Today"
            action={`${today.length} lesson${today.length === 1 ? "" : "s"}`}
          />
          <CardBody tight>
            <ul className="divide-y divide-line">
              {today.map((l) => (
                <LessonRow key={l.id} lesson={l} />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {classGroups.length === 0 ? (
        today.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-sm text-muted text-center py-2">
                No lessons in the last 4 weeks.
              </div>
            </CardBody>
          </Card>
        ) : null
      ) : (
        classGroups.map((g) => {
          const accent = getAccentTokens(colorFamilyForSubject(g.subjectName));
          const initial = g.subjectName.charAt(0).toUpperCase();
          const unmarked = g.lessons.filter(
            (l) =>
              l.date < todayIso && (l.marked === 0 || l.marked < l.roster),
          ).length;
          return (
            <Card key={g.classId} className="overflow-hidden">
              <div
                className="px-4 py-3 flex items-center gap-3 border-b border-line"
                style={{
                  background: `linear-gradient(135deg, ${accent.bgFrom} 0%, ${accent.bgTo} 100%)`,
                }}
              >
                <div
                  className="h-9 w-9 rounded-[10px] grid place-items-center text-[14px] font-extrabold shrink-0"
                  style={{ background: accent.title, color: "#fff" }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[10px] uppercase tracking-[0.12em] font-bold"
                    style={{ color: accent.meta }}
                  >
                    {g.subjectName}
                  </div>
                  <div
                    className="text-[14px] font-extrabold leading-tight truncate"
                    style={{ color: accent.title }}
                  >
                    {g.className}
                  </div>
                </div>
                {unmarked > 0 ? (
                  <Pill tone="warn">{unmarked} to mark</Pill>
                ) : (
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: accent.meta }}
                  >
                    {g.lessons.length} lesson{g.lessons.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <CardBody tight>
                <ul className="divide-y divide-line">
                  {g.lessons.map((l) => (
                    <LessonRow key={l.id} lesson={l} hideClass />
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}

type LessonRowProps = {
  lesson: Awaited<ReturnType<typeof getTutorAttendanceOverview>>[number];
  hideClass?: boolean;
};

function LessonRow({ lesson: l, hideClass = false }: LessonRowProps) {
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
        {hideClass ? (
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-ink tabular-nums">
              {formatDateLong(l.date)}
            </div>
            <div className="text-[11px] text-muted mt-0.5 tabular-nums">
              {formatTime(l.startTime)} · {l.roster} enrolled
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
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
