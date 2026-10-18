import Link from "next/link";
import { eq } from "drizzle-orm";
import { PageHeader, SubjectDot, buttonVariants } from "@/components/admin/ui";
import type { RollStudent } from "@/components/attendance/attendance-row";
import { db } from "@/db/client";
import { classes } from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { formatDateShort, formatTimeRange, formatWeekday, yearLevelLabel } from "@/lib/format";
import { getLessonReschedules } from "@/lib/reschedule";
import { getLessonWeek } from "@/lib/week-plans";
import { cn } from "@/lib/utils";
import { getLessonForTutor, getStudentTrialsOnDate, requireTutor } from "../../_data";
import { LessonAttendance } from "./_components/lesson-attendance";
import { LessonNotesEditor, type NoteStudent } from "./_components/lesson-notes-editor";
import { RecordingCard } from "./_components/recording-card";
import { WeekPlanCard } from "./_components/week-plan-card";

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const cameFromSchedule = from === "schedule";
  const tutor = await requireTutor();
  // Scoped to lessons this tutor teaches; 404s otherwise.
  const { lesson, roster, notes } = await getLessonForTutor(tutor.id, id);

  const [{ movedOut, movedIn }, week, [cls]] = await Promise.all([
    getLessonReschedules(id),
    getLessonWeek(lesson.classId, lesson.date),
    db
      .select({ tutorId: classes.tutorId })
      .from(classes)
      .where(eq(classes.id, lesson.classId))
      .limit(1),
  ]);
  // A covering tutor teaches the lesson but not the class: the class tabs
  // would 404 for them, so those links only show for the class's own tutor.
  const ownsClass = cls?.tutorId === tutor.id;

  const movedOutById = new Map(movedOut.map((m) => [m.studentId, m.toLabel]));
  const rosterIds = new Set(roster.map((s) => s.id));
  const makeups = movedIn.filter((m) => !rosterIds.has(m.studentId));
  const makeupTrials = new Map(
    (await getStudentTrialsOnDate(makeups.map((m) => m.studentId), lesson.date)).map(
      (trial) => [trial.studentId, trial],
    ),
  );

  const rollStudents: RollStudent[] = [
    ...roster.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`.trim(),
      status: s.attendanceStatus,
      note: s.attendanceNote ?? "",
      onTrial: s.onTrial,
      trialNote: s.trialNote,
      onLeave: s.onLeave,
      detail: s.yearLevel ? yearLevelLabel(s.yearLevel) : null,
      href: `/tutor/students/${s.id}`,
      movedOutTo: movedOutById.get(s.id),
    })),
    ...makeups.map((m) => {
      const trial = makeupTrials.get(m.studentId);
      return {
        id: m.studentId,
        name: m.studentName,
        status: m.attendanceStatus ?? "makeup_attended",
        note: m.attendanceNote ?? "",
        onTrial: Boolean(trial),
        trialNote: trial?.note?.trim() || null,
        makeupFrom: m.fromLabel,
      };
    }),
  ];

  const notesByStudent = new Map(notes.map((n) => [n.studentId, n]));
  const noteStudents: NoteStudent[] = rollStudents.map((s) => {
    const n = notesByStudent.get(s.id);
    return {
      id: s.id,
      name: s.name,
      isMakeup: Boolean(s.makeupFrom),
      savedAt: n ? n.createdAt.toISOString() : null,
      note: n
        ? {
            topicCovered: n.topicCovered ?? "",
            performance: n.performance ?? "",
            strengths: n.strengths ?? "",
            struggles: n.struggles ?? "",
            nextLessonFocus: n.nextLessonFocus ?? "",
            parentVisibleComment: n.parentVisibleComment ?? "",
            internalNote: n.internalNote ?? "",
          }
        : null,
    };
  });

  const title = classDisplayName(lesson.subjectName, lesson.className);
  const when = [
    `${formatWeekday(lesson.date, "short")} ${formatDateShort(lesson.date)}`,
    formatTimeRange(lesson.startTime, lesson.endTime),
    lesson.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const weekPlanHref =
    ownsClass && week
      ? `/tutor/classes/${lesson.classId}/curriculum?term=${week.termId}&week=${week.subjectWeekId}`
      : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={
          cameFromSchedule
            ? { href: "/tutor/timetable", label: "Back to Schedule & availability" }
            : { href: "/tutor", label: "Back to Today" }
        }
        eyebrow={
          <>
            <SubjectDot subject={lesson.subjectName} color={lesson.subjectColor} />
            <span className="tabular-nums">{when}</span>
          </>
        }
        title={title}
        actions={
          ownsClass ? (
            <Link
              href={`/tutor/classes/${lesson.classId}/lessons`}
              className={cn(buttonVariants({ variant: "glass", size: "lg" }), "font-semibold")}
            >
              All lessons for this class
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-start gap-5">
        <LessonAttendance
          lessonId={lesson.id}
          students={rollStudents}
          enrolledCount={roster.length}
          makeupCount={makeups.length}
        />
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5 lg:max-w-[420px]">
          <WeekPlanCard week={week} editHref={weekPlanHref} />
          <RecordingCard
            lessonId={lesson.id}
            recordingUrl={lesson.recordingUrl}
            title={`${lesson.subjectName} lesson recording`}
          />
        </div>
      </div>

      <LessonNotesEditor lessonId={lesson.id} students={noteStudents} />
    </div>
  );
}
