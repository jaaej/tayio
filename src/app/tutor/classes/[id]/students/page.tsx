import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
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
    todaysLesson ?? allLessons.find((l) => l.date >= today) ?? null;

  const studentIds = students.map((s) => s.id);
  const summaries: Map<
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
    <div className="space-y-5">
      <Link
        href="/tutor/classes"
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-600 hover:text-brand-700"
      >
        ← Back to classes
      </Link>

      <PageHead
        eyebrow={cls.subjectName}
        title={`${cls.name} - Students`}
      />

      {todaysLesson ? (
        <Card className="border-brand-300 bg-brand-50">
          <CardBody>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[13px] font-bold text-ink">
                  Today's lesson · {formatTime(todaysLesson.startTime)} –{" "}
                  {formatTime(todaysLesson.endTime)}
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  Mark attendance now (syncs to admin records).
                </div>
              </div>
              <Link
                href={`/tutor/lessons/${todaysLesson.id}`}
                className="rounded-full bg-brand-600 text-white px-3.5 py-1.5 text-[12px] font-bold hover:bg-brand-700"
              >
                Mark attendance →
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : nextLesson ? (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[13px] font-bold text-ink">
                  Next lesson · {formatDateLong(nextLesson.date)}{" "}
                  {formatTime(nextLesson.startTime)}
                </div>
                <div className="text-[12px] text-muted mt-0.5">
                  Attendance can be marked when the lesson page is open.
                </div>
              </div>
              <Link
                href={`/tutor/lessons/${nextLesson.id}`}
                className="rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-[12px] font-bold text-ink hover:bg-brand-50 hover:border-brand-200"
              >
                Open lesson →
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHead title="Enrolled students" action={`${students.length} total`} />
        <CardBody tight>
          {students.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted text-center">
              No students enrolled yet. Admin manages enrolment.
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {students.map((s) => {
                const sum = summaries.get(s.id);
                const rate =
                  sum && sum.total > 0
                    ? Math.round(
                        ((sum.present + sum.late) / sum.total) * 100,
                      )
                    : null;
                const tone =
                  rate === null
                    ? "neutral"
                    : rate >= 90
                      ? "good"
                      : rate >= 70
                        ? "warn"
                        : "bad";
                return (
                  <li key={s.id}>
                    <Link
                      href={`/tutor/students/${s.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-brand-500 text-white grid place-items-center text-[12px] font-bold shrink-0">
                          {s.firstName.charAt(0)}
                          {s.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-ink truncate">
                            {s.firstName} {s.lastName}
                          </div>
                          <div className="text-[11px] text-muted truncate">
                            {s.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {sum && sum.total > 0 ? (
                          <div className="text-right">
                            <Pill tone={tone as never}>{rate}% attendance</Pill>
                            <div className="text-[10px] text-muted mt-1">
                              {sum.present} present · {sum.late} late ·{" "}
                              {sum.absent} absent
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted">
                            No attendance yet
                          </span>
                        )}
                        <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-brand-600">
                          Open →
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
