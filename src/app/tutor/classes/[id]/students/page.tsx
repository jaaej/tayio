import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  enrollments,
  lessons,
  profiles,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime, isoDate } from "@/lib/format";

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  left_early: "Left early",
  makeup_attended: "Make-up",
};

const ATTENDANCE_TONE: Record<string, string> = {
  present: "text-emerald-700 bg-emerald-50",
  late: "text-amber-700 bg-amber-50",
  absent: "text-rose-700 bg-rose-50",
  left_early: "text-amber-700 bg-amber-50",
  makeup_attended: "text-brand-700 bg-brand-50",
};

export default async function TutorClassStudentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("tutor");
  const { id: classId } = await params;

  const [cls] = await db
    .select({
      id: classes.id,
      name: classes.name,
      subjectName: subjects.name,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(classes.id, classId), eq(classes.tutorId, user.id)))
    .limit(1);
  if (!cls) notFound();

  // Enrolled students.
  const students = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .where(
      and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt)),
    )
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));

  // Lessons for this class to compute attendance summaries + locate today's lesson.
  const allLessons = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
    })
    .from(lessons)
    .where(eq(lessons.classId, classId))
    .orderBy(asc(lessons.date));

  const today = isoDate(new Date());
  const todaysLesson = allLessons.find((l) => l.date === today) ?? null;
  const nextLesson =
    todaysLesson ??
    allLessons.find((l) => l.date >= today) ??
    null;

  // Attendance summary per student.
  const studentIds = students.map((s) => s.id);
  let summaries: Map<
    string,
    { present: number; late: number; absent: number; total: number }
  > = new Map();

  if (studentIds.length > 0) {
    const attendanceRows = await db
      .select({
        studentId: attendance.studentId,
        status: attendance.status,
        total: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
      .where(
        and(
          eq(lessons.classId, classId),
          inArray(attendance.studentId, studentIds),
        ),
      )
      .groupBy(attendance.studentId, attendance.status);

    for (const r of attendanceRows) {
      const existing = summaries.get(r.studentId) ?? {
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      };
      existing.total += r.total;
      if (r.status === "present" || r.status === "makeup_attended") {
        existing.present += r.total;
      } else if (r.status === "late" || r.status === "left_early") {
        existing.late += r.total;
      } else if (r.status === "absent") {
        existing.absent += r.total;
      }
      summaries.set(r.studentId, existing);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/tutor/classes"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← Back to classes
      </Link>

      <header className="space-y-1">
        <h1 className="text-3xl font-medium text-ink">
          {cls.name} — Students
        </h1>
        <p className="text-sm text-ink-soft">
          {cls.subjectName} · {students.length} enrolled
        </p>
      </header>

      {/* Attendance CTA */}
      {todaysLesson ? (
        <Card className="border-brand-300 bg-brand-50/40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-ink">
                Today's lesson · {formatTime(todaysLesson.startTime)} –{" "}
                {formatTime(todaysLesson.endTime)}
              </div>
              <div className="text-xs text-ink-soft mt-0.5">
                Mark attendance now (syncs to admin records).
              </div>
            </div>
            <Link
              href={`/tutor/lessons/${todaysLesson.id}`}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
            >
              Mark attendance →
            </Link>
          </div>
        </Card>
      ) : nextLesson ? (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-ink">
                Next lesson · {formatDateLong(nextLesson.date)}{" "}
                {formatTime(nextLesson.startTime)}
              </div>
              <div className="text-xs text-ink-soft mt-0.5">
                Attendance can be marked when the lesson page is open.
              </div>
            </div>
            <Link
              href={`/tutor/lessons/${nextLesson.id}`}
              className="rounded-lg border border-hairline/60 px-4 py-2 text-sm font-medium hover:bg-brand-50"
            >
              Open lesson →
            </Link>
          </div>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 text-base font-medium text-ink">
          Enrolled students
        </div>
        {students.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-soft">
            No students enrolled yet. Admin manages enrolment.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {students.map((s) => {
              const sum = summaries.get(s.id);
              const rate =
                sum && sum.total > 0
                  ? Math.round(((sum.present + sum.late) / sum.total) * 100)
                  : null;
              return (
                <li key={s.id}>
                  <Link
                    href={`/tutor/students/${s.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-brand-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-base text-ink truncate">
                        {s.firstName} {s.lastName}
                      </div>
                      <div className="text-xs text-muted truncate">
                        {s.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {sum && sum.total > 0 ? (
                        <div className="text-right">
                          <div className="text-sm text-ink tabular-nums">
                            {rate}% attendance
                          </div>
                          <div className="text-[11px] text-ink-soft">
                            {sum.present} present · {sum.late} late ·{" "}
                            {sum.absent} absent
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">
                          No attendance records yet
                        </span>
                      )}
                      <span className="text-[11px] uppercase tracking-wide text-brand-700">
                        Open →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
