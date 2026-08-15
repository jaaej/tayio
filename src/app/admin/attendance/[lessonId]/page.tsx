import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
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
  lessons,
  profiles,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";
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

  return (
    <div className="space-y-6">
      <BackLink href="/admin/attendance">Back to attendance</BackLink>

      <Hero
        className="rise"
        eyebrow="Attendance"
        icon={<CalendarCheck className="h-7 w-7" />}
        title={lesson.className}
        chips={
          <>
            <HeroChip>{formatDateLong(lesson.date)}</HeroChip>
            <HeroChip>
              {formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}
            </HeroChip>
            <HeroChip>{lesson.subjectName}</HeroChip>
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
                      <div className="text-[14px] font-bold text-ink">
                        {s.firstName} {s.lastName}
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
          <div className="border-t border-line">
            <div className="px-5 pt-4 pb-2 text-[11px] uppercase tracking-[0.14em] font-bold text-ink-soft">
              Make-up attendees
            </div>
            <ul className="divide-y divide-line">
              {movedIn.map((m) => (
                <li
                  key={m.studentId}
                  className="px-5 py-4 flex items-baseline justify-between gap-3"
                >
                  <div className="text-[14px] font-bold text-ink">
                    {m.studentName}
                  </div>
                  <Pill tone="mint">Make-up ← {m.fromLabel}</Pill>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
