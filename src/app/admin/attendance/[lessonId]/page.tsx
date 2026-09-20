import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { CalendarCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHead,
  Pill,
  BackLink,
  Hero,
  HeroChip,
  Button,
  Empty,
} from "@/components/admin/ui";
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
import { adminSaveAttendance } from "@/app/admin/_lib/actions-attendance";

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "left_early", label: "Left early" },
  { value: "absent", label: "Absent" },
  { value: "makeup_attended", label: "Make-up" },
] as const;

export default async function AdminLessonAttendancePage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  await requireRole("admin");
  const { lessonId } = await params;

  const [lesson] = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
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

  // Roster - enrolled students for the class, with current attendance status if any.
  const roster = await db
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
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));

  // Reschedules - who left this lesson (and where to) and who's here as a make-up.
  const { movedOut, movedIn } = await getLessonReschedules(lessonId);
  const movedOutById = new Map(movedOut.map((m) => [m.studentId, m.toLabel]));
  const attendanceStudentIds = Array.from(
    new Set([
      ...roster.map((student) => student.id),
      ...movedIn.map((student) => student.studentId),
    ]),
  );
  const trialRows = attendanceStudentIds.length
    ? await db
        .select({ studentId: studentTrials.studentId })
        .from(studentTrials)
        .where(
          and(
            inArray(studentTrials.studentId, attendanceStudentIds),
            sql`${studentTrials.startDate} <= ${lesson.date}`,
            sql`${studentTrials.endDate} >= ${lesson.date}`,
          ),
        )
    : [];
  const onTrialIds = new Set(trialRows.map((row) => row.studentId));
  const noteRows = await db
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
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));

  return (
    <div className="space-y-6">
      <BackLink href="/admin/attendance">Back to attendance</BackLink>

      <Hero
        className="rise"
        eyebrow="Attendance"
        icon={<CalendarCheck className="h-7 w-7" />}
        title={lessonTitle}
        chips={
          <>
            <HeroChip>{formatDateLong(lesson.date)}</HeroChip>
            <HeroChip>
              {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
            </HeroChip>
            {classDetail && <HeroChip>{lesson.subjectName}</HeroChip>}
            <HeroChip>
              Tutor: {lesson.tutorFirst} {lesson.tutorLast}
            </HeroChip>
          </>
        }
      />

      <Card className="rise">
        <CardHead
          title="Attendance"
          action={<Pill tone="brand">{roster.length} enrolled</Pill>}
        />
        {roster.length === 0 && movedIn.length === 0 ? (
          <Empty>No students enrolled in this class.</Empty>
        ) : roster.length === 0 ? null : (
          <form action={adminSaveAttendance}>
            <input type="hidden" name="lessonId" value={lesson.id} />
            <ul className="divide-y divide-line">
              {roster.map((s) => {
                const current = s.attendanceStatus ?? "";
                return (
                  <li key={s.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-bold text-ink">
                          {s.firstName} {s.lastName}
                        </span>
                        {onTrialIds.has(s.id) && (
                          <Pill tone="info">Free trial</Pill>
                        )}
                      </div>
                      {movedOutById.has(s.id) && (
                        <Pill tone="warn">
                          Rescheduled → {movedOutById.get(s.id)}
                        </Pill>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ATTENDANCE_OPTIONS.map((opt) => (
                        <label key={opt.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`status[${s.id}]`}
                            value={opt.value}
                            defaultChecked={current === opt.value}
                            className="peer sr-only"
                          />
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-line text-[12px] font-semibold text-ink-soft peer-checked:bg-brand-500 peer-checked:text-white peer-checked:border-brand-500 hover:border-brand-400 transition-colors">
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <Input
                      name={`note[${s.id}]`}
                      placeholder="Optional note (e.g. arrived 10 min late)"
                      defaultValue={s.attendanceNote ?? ""}
                      className="h-9 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
            <div className="px-5 py-4 border-t border-line bg-surface-2 flex justify-end">
              <Button type="submit" size="sm" variant="primary">
                Save attendance
              </Button>
            </div>
          </form>
        )}
        {movedIn.length > 0 && (
          <form action={adminSaveAttendance} className="border-t border-line">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <div className="px-5 pt-4 pb-2 text-[11px] uppercase tracking-[0.14em] font-bold text-ink-soft">
              Make-up attendees
            </div>
            <ul className="divide-y divide-line">
              {movedIn.map((m) => (
                <li
                  key={m.studentId}
                  className="space-y-3 px-5 py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-bold text-ink">
                        {m.studentName}
                      </span>
                      {onTrialIds.has(m.studentId) && (
                        <Pill tone="info">Free trial</Pill>
                      )}
                    </div>
                    <Pill tone="mint">Make-up ← {m.fromLabel}</Pill>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ATTENDANCE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="cursor-pointer">
                        <input
                          type="radio"
                          name={`status[${m.studentId}]`}
                          value={opt.value}
                          defaultChecked={
                            (m.attendanceStatus ?? "makeup_attended") ===
                            opt.value
                          }
                          className="peer sr-only"
                        />
                        <span className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-brand-400 peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:text-white">
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <Input
                    name={`note[${m.studentId}]`}
                    placeholder="Optional note (e.g. attended a make-up lesson)"
                    defaultValue={m.attendanceNote ?? ""}
                    className="h-9 text-sm"
                  />
                </li>
              ))}
            </ul>
            <div className="flex justify-end border-t border-line bg-surface-2 px-5 py-4">
              <Button type="submit" size="sm" variant="primary">
                Save make-up attendance
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="rise">
        <CardHead title="Lesson notes" />
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
                <section key={note.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-bold text-ink">
                      {note.firstName} {note.lastName}
                    </h3>
                    {movedIn.some((student) => student.studentId === note.studentId) && (
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
      </Card>
    </div>
  );
}
