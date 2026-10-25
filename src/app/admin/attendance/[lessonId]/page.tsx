import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Empty, Pill } from "@/components/admin/ui";
import { db } from "@/db/client";
import { classes, lessonNotes, lessonRollExclusions, lessons, profiles, subjects } from "@/db/schema";
import { STUDENT_TIERS } from "@/lib/roles";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTimeRange, yearLevelLabel } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { subjectTone } from "@/lib/subject-tone";
import { lessonStartInstant } from "@/lib/tutor-cover-rules";
import { getLessonRoll } from "@/lib/lesson-roll";
import { AttendanceQueue } from "../_components/attendance-queue";
import { DeleteLessonButton } from "../_components/delete-lesson-button";
import { CancelLessonButton } from "@/components/lessons/cancel-lesson-button";
import { LessonNotesButton } from "../_components/lesson-notes-button";
import { MarkingPane, type MarkingStudent, type RollEdit } from "../_components/marking-pane";
import { getAttendanceQueue, parseQueueFilters } from "../_lib/queue";
import { nextLessonId, queueQueryString } from "../_lib/queue-logic";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: string; date?: string; from?: string; class?: string }>;

export default async function AdminLessonAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const { lessonId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();
  const filters = parseQueueFilters(await searchParams);

  const [lesson] = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      cancelledAt: lessons.cancelledAt,
      className: classes.name,
      classId: classes.id,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) notFound();
  // "Y7 Mathematics · Tuesday": a class name alone is often just its weekday.
  const lessonTitle = classDisplayName(lesson.subjectName, lesson.className);

  const editable = !["makeup", "cancelled", "rescheduled"].includes(lesson.status);
  const [queue, roll, noteRows, studentRows, excludedRows] = await Promise.all([
    getAttendanceQueue(filters),
    getLessonRoll(lesson),
    db
      .select({
        id: lessonNotes.id,
        studentId: lessonNotes.studentId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        topicCovered: lessonNotes.topicCovered,
        keyConcepts: lessonNotes.keyConcepts,
        performance: lessonNotes.performance,
        strengths: lessonNotes.strengths,
        struggles: lessonNotes.struggles,
        nextLessonFocus: lessonNotes.nextLessonFocus,
        parentVisibleComment: lessonNotes.parentVisibleComment,
        internalNote: lessonNotes.internalNote,
      })
      .from(lessonNotes)
      .innerJoin(profiles, eq(profiles.id, lessonNotes.studentId))
      .where(eq(lessonNotes.lessonId, lessonId))
      .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
    // Who can be added: every active student (those on the roll are left out below).
    editable
      ? db
          .select({
            id: profiles.id,
            firstName: profiles.firstName,
            lastName: profiles.lastName,
            yearLevel: profiles.yearLevel,
            school: profiles.school,
          })
          .from(profiles)
          .where(and(inArray(profiles.role, STUDENT_TIERS), eq(profiles.isActive, true)))
          .orderBy(asc(profiles.firstName), asc(profiles.lastName))
      : Promise.resolve([]),
    db
      .select({ studentId: lessonRollExclusions.studentId })
      .from(lessonRollExclusions)
      .where(eq(lessonRollExclusions.lessonId, lessonId)),
  ]);

  const students: MarkingStudent[] = roll.map((s) => ({ ...s, href: `/admin/users/${s.id}` }));
  const onRoll = new Set(roll.map((s) => s.id));
  const noted = new Set(noteRows.map((n) => n.studentId));
  const rollEdit: RollEdit | undefined = editable
    ? {
        candidates: studentRows
          .filter((r) => !onRoll.has(r.id))
          .map((r) => ({
            id: r.id,
            name: `${r.firstName} ${r.lastName}`.trim(),
            detail: [r.yearLevel ? yearLevelLabel(r.yearLevel) : null, r.school].filter(Boolean).join(" · "),
          })),
        lessonDay: formatDateLong(lesson.date),
        classStudentIds: roll.filter((s) => s.inClass).map((s) => s.id),
        excludedIds: excludedRows.map((r) => r.studentId),
        // Moved, cancelled, on a credit or noted by the tutor: undone elsewhere.
        lockedIds: roll
          .filter((s) => s.movedOutTo || s.tookCredit || s.makeupFrom || noted.has(s.id))
          .map((s) => s.id),
      }
    : undefined;

  const query = queueQueryString(filters);
  const lessonSubject = {
    label: [
      classDisplayName(lesson.subjectName, lesson.className),
      formatDateLong(lesson.date),
      formatTimeRange(lesson.startTime, lesson.endTime),
    ].join(" · "),
    dot: subjectTone(lesson.subjectName, lesson.subjectColor).dot,
  };
  const nextId = nextLessonId(
    queue.items.map((item) => item.id),
    lesson.id,
  );
  const makeupIds = new Set(roll.filter((s) => s.makeupFrom).map((s) => s.id));

  const sub = [
    formatDateLong(lesson.date),
    formatTimeRange(lesson.startTime, lesson.endTime),
    `${lesson.tutorFirst} ${lesson.tutorLast}`,
    `${students.length} ${students.length === 1 ? "student" : "students"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <AttendanceQueue
        queue={queue}
        basePath={`/admin/attendance/${lesson.id}`}
        currentLessonId={lesson.id}
        headingLevel="h2"
        className="hidden xl:flex"
      />

      {lesson.status === "cancelled" ? (
        <section className="glass flex min-w-0 flex-1 flex-col rounded-[24px] p-1.5">
          <div className="flex flex-col gap-0.5 py-2.5 pl-3.5 pr-2.5">
            <h1 className="text-[20px] font-extrabold leading-tight text-ink">{lessonTitle}</h1>
            <p className="text-[13px] font-semibold text-ink-soft">{sub}</p>
          </div>
          <div className="panel p-5 text-[14px] text-ink-soft">
            <p className="font-bold text-ink">
              Cancelled{lesson.cancelledAt ? ` on ${formatDateLong(lesson.cancelledAt)}` : ""}.
            </p>
            {lesson.cancelledAt && (
              <p className="mt-1">Each student it was for has a class credit to book a make-up.</p>
            )}
          </div>
        </section>
      ) : (
      <MarkingPane
        key={lesson.id}
        lessonId={lesson.id}
        title={lessonTitle}
        sub={sub}
        students={students}
        backHref={`/admin/attendance${query}`}
        nextHref={nextId ? `/admin/attendance/${nextId}${query}` : null}
        rollEdit={rollEdit}
        headerAction={
          <>
            {lesson.status !== "rescheduled" && (
              <CancelLessonButton lessonId={lesson.id} subject={lessonSubject} />
            )}
            {lessonStartInstant(lesson.date, lesson.startTime) <= new Date() && (
              <DeleteLessonButton
                lessonId={lesson.id}
                backHref={`/admin/attendance${query}`}
                subject={lessonSubject}
              />
            )}
          </>
        }
        notesButton={
          <LessonNotesButton
            count={noteRows.length}
            sub={`${lessonTitle} · ${formatDateLong(lesson.date)}`}
          >
            {noteRows.length === 0 ? (
              <Empty>No tutor notes have been saved for this lesson.</Empty>
            ) : (
              <div className="divide-y divide-line">
                {noteRows.map((note) => {
                  const details = [
                    ["Topic covered", note.topicCovered],
                    ["Key concepts", note.keyConcepts],
                    ["Performance", note.performance],
                    ["Strengths", note.strengths],
                    ["Struggled with", note.struggles],
                    ["Next lesson focus", note.nextLessonFocus],
                    ["Parent-visible comment", note.parentVisibleComment],
                    ["Internal note", note.internalNote],
                  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

                  return (
                    <section key={note.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-bold text-ink">
                          {note.firstName} {note.lastName}
                        </h3>
                        {makeupIds.has(note.studentId) && (
                          <Pill tone="mint">Make-up attendee</Pill>
                        )}
                      </div>
                      {details.length === 0 ? (
                        <p className="mt-2 text-[12px] text-muted">Empty note.</p>
                      ) : (
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                          {details.map(([label, value]) => (
                            <div key={label} className="rounded-[10px] bg-surface-2 p-3">
                              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                                {label}
                              </dt>
                              <dd className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-ink-soft">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </LessonNotesButton>
        }
      />
      )}
    </div>
  );
}
