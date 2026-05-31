import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatDateLong, formatTime } from "@/lib/format";
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

  // Roster — enrolled students for the class, with current attendance status if any.
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

  return (
    <div className="space-y-6">
      <Link
        href="/admin/attendance"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← Back to attendance
      </Link>

      <header className="rise space-y-2">
        <h1 className="text-3xl lg:text-4xl font-medium tracking-tight text-ink">
          {lesson.className} · {formatDateLong(lesson.date)}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className="tabular-nums">
            {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
          </span>
          <span>{lesson.subjectName}</span>
          <span>
            Tutor: {lesson.tutorFirst} {lesson.tutorLast}
          </span>
        </div>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between">
          <div className="text-xl font-medium text-ink">Attendance</div>
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            {roster.length} enrolled
          </span>
        </div>
        {roster.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No students enrolled in this class.
          </div>
        ) : (
          <form action={adminSaveAttendance}>
            <input type="hidden" name="lessonId" value={lesson.id} />
            <ul className="divide-y divide-hairline/60">
              {roster.map((s) => {
                const current = s.attendanceStatus ?? "";
                return (
                  <li key={s.id} className="px-5 py-4 space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-base text-ink">
                        {s.firstName} {s.lastName}
                      </div>
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
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-hairline text-xs text-ink-soft peer-checked:bg-ink peer-checked:text-white peer-checked:border-ink hover:border-brand-400 transition-colors">
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
            <div className="px-5 py-4 border-t border-hairline/60 bg-brand-50/40 flex justify-end">
              <Button type="submit" size="sm" variant="primary">
                Save attendance
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
