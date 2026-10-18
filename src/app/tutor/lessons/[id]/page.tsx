import Link from "next/link";
import { eq } from "drizzle-orm";
import { GlassPanel, PageHeader, SubjectDot, buttonVariants } from "@/components/admin/ui";
import { db } from "@/db/client";
import { classes } from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { formatDateShort, formatTimeRange, formatWeekday } from "@/lib/format";
import { getLessonRoll } from "@/lib/lesson-roll";
import { getCoverHandover } from "@/lib/tutor-cover";
import { getLessonWeek } from "@/lib/week-plans";
import { cn } from "@/lib/utils";
import { getLessonForTutor, requireTutor } from "../../_data";
import { LessonAttendance } from "./_components/lesson-attendance";
import { LessonNotesEditor, type NoteStudent } from "./_components/lesson-notes-editor";
import { RecordingCard } from "./_components/recording-card";
import { WeekPlanCard } from "./_components/week-plan-card";

export default async function LessonDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; student?: string }>;
}) {
  const { id } = await params;
  const { from, student: fromStudent } = await searchParams;
  const cameFrom = from === "schedule" || from === "class" || from === "student" ? from : null;
  const tutor = await requireTutor();
  // Scoped to lessons this tutor teaches; 404s otherwise.
  const { lesson, notes } = await getLessonForTutor(tutor.id, id);

  const [roll, week, [cls], handover] = await Promise.all([
    getLessonRoll(lesson),
    getLessonWeek(lesson.classId, lesson.date),
    db
      .select({ tutorId: classes.tutorId })
      .from(classes)
      .where(eq(classes.id, lesson.classId))
      .limit(1),
    getCoverHandover(lesson.id, tutor.id),
  ]);
  // A covering tutor teaches the lesson but not the class: the class tabs
  // would 404 for them, so those links only show for the class's own tutor.
  const ownsClass = cls?.tutorId === tutor.id;

  // The class's own students link to their profile; anyone else on the roll
  // (a make-up attendee) is not one of this tutor's students.
  const rollStudents = roll.map((s) => (s.inClass ? { ...s, href: `/tutor/students/${s.id}` } : s));

  const notesByStudent = new Map(notes.map((n) => [n.studentId, n]));
  const noteStudents: NoteStudent[] = rollStudents.map((s) => {
    const n = notesByStudent.get(s.id);
    return {
      id: s.id,
      name: s.name,
      isMakeup: Boolean(s.makeupFrom),
      absent: s.status === "absent",
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
          cameFrom === "schedule"
            ? { href: "/tutor/timetable", label: "Back to Schedule & availability" }
            : cameFrom === "class" && ownsClass
              ? { href: `/tutor/classes/${lesson.classId}/lessons`, label: "Back to class" }
              : cameFrom === "student" && fromStudent && roll.some((s) => s.id === fromStudent)
                ? { href: `/tutor/students/${fromStudent}?tab=lessons`, label: "Back to student" }
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
          enrolledCount={roll.filter((s) => s.inClass).length}
          makeupCount={roll.filter((s) => s.makeupFrom).length}
        />
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5 lg:max-w-[420px]">
          {handover && (
            <GlassPanel
              title={`Covering for ${handover.originalTutorFirst} ${handover.originalTutorLast}`.trim()}
              titleId="handover-heading"
            >
              <p className="whitespace-pre-wrap p-3.5 text-[14px] leading-[1.55] text-ink [overflow-wrap:anywhere]">
                {handover.handoverNote?.trim() || (
                  <span className="text-[13px] text-muted">No handover note was left.</span>
                )}
              </p>
            </GlassPanel>
          )}
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
