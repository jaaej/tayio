import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Empty, Pill } from "@/components/admin/ui";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  lessonNotes,
  lessons,
  profiles,
  studentTrials,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
import { classNameDetail } from "@/lib/class-display";
import { getLessonReschedules } from "@/lib/reschedule";
import { AttendanceQueue } from "../_components/attendance-queue";
import { LessonNotesButton } from "../_components/lesson-notes-button";
import { MarkingPane, type MarkingStudent } from "../_components/marking-pane";
import { getAttendanceQueue, parseQueueFilters } from "../_lib/queue";
import { nextLessonId, queueQueryString } from "../_lib/queue-logic";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: string; date?: string; from?: string }>;

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
      className: classes.name,
      classId: classes.id,
      subjectName: subjects.name,
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
  const classDetail = classNameDetail(lesson.subjectName, lesson.className);
  const lessonTitle = classDetail || lesson.subjectName;

  const [queue, roster, reschedules, noteRows] = await Promise.all([
    getAttendanceQueue(filters),
    // A make-up lesson's roll is only the students moved into it (the save
    // action rejects anyone else), so the class roster is not listed there.
    lesson.status === "makeup"
      ? Promise.resolve([])
      : db
          .select({
            id: profiles.id,
            firstName: profiles.firstName,
            lastName: profiles.lastName,
            attendanceStatus: attendance.status,
            attendanceNote: attendance.note,
          })
          .from(enrollments)
          .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
          .leftJoin(
            attendance,
            and(
              eq(attendance.studentId, enrollments.studentId),
              eq(attendance.lessonId, lessonId),
            ),
          )
          .where(
            and(
              eq(enrollments.classId, lesson.classId),
              isNull(enrollments.withdrawnAt),
            ),
          )
          .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
    getLessonReschedules(lessonId),
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
  ]);

  // Reschedules - who left this lesson (and where to) and who's here as a make-up.
  const { movedOut, movedIn } = reschedules;
  const movedOutById = new Map(movedOut.map((m) => [m.studentId, m.toLabel]));
  const rosterIds = new Set(roster.map((s) => s.id));
  const makeups = movedIn.filter((m) => !rosterIds.has(m.studentId));
  const studentIds = [...rosterIds, ...makeups.map((m) => m.studentId)];
  const trialRows = studentIds.length
    ? await db
        .select({ studentId: studentTrials.studentId })
        .from(studentTrials)
        .where(
          and(
            inArray(studentTrials.studentId, studentIds),
            sql`${studentTrials.startDate} <= ${lesson.date}`,
            sql`${studentTrials.endDate} >= ${lesson.date}`,
          ),
        )
    : [];
  const onTrialIds = new Set(trialRows.map((row) => row.studentId));

  const students: MarkingStudent[] = [
    ...roster.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`.trim(),
      status: s.attendanceStatus,
      note: s.attendanceNote ?? "",
      onTrial: onTrialIds.has(s.id),
      movedOutTo: movedOutById.get(s.id),
    })),
    ...makeups.map((m) => ({
      id: m.studentId,
      name: m.studentName,
      status: m.attendanceStatus ?? "makeup_attended",
      note: m.attendanceNote ?? "",
      onTrial: onTrialIds.has(m.studentId),
      makeupFrom: m.fromLabel,
    })),
  ];

  const query = queueQueryString(filters);
  const nextId = nextLessonId(
    queue.items.map((item) => item.id),
    lesson.id,
  );
  const makeupIds = new Set(movedIn.map((m) => m.studentId));

  const sub = [
    formatDateLong(lesson.date),
    `${formatTime(lesson.startTime)} – ${formatTime(lesson.endTime)}`,
    classDetail ? lesson.subjectName : null,
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
        className="hidden xl:flex xl:w-[360px] xl:shrink-0 2xl:w-[400px]"
      />

      <MarkingPane
        key={lesson.id}
        lessonId={lesson.id}
        title={lessonTitle}
        sub={sub}
        students={students}
        backHref={`/admin/attendance${query}`}
        nextHref={nextId ? `/admin/attendance/${nextId}${query}` : null}
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
    </div>
  );
}
