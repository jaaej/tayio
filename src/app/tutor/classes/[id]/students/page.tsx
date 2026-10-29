import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { Avatar, Empty, GlassPanel, Pill } from "@/components/admin/ui";
import { db } from "@/db/client";
import { attendance, enrollments, lessons, profiles } from "@/db/schema";
import { requireTutor } from "@/app/tutor/_data";
import { attendanceMovedSql } from "@/lib/attendance-moved";
import {
  attendanceRateTone,
  attendanceSummary,
  isMovedAbsence,
  type AttendanceMark,
} from "@/lib/attendance-rules";
import { getClassHub } from "../_lib/class-hub";
import { ClassHero } from "../_components/class-hero";

export default async function TutorClassStudentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tutor = await requireTutor();
  const { id: classId } = await params;
  const hub = await getClassHub(tutor.id, classId);
  if (!hub) notFound();

  const students = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .where(
      and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt)),
    )
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));

  const studentIds = students.map((s) => s.id);
  const marksByStudent = new Map<string, AttendanceMark[]>();
  if (studentIds.length > 0) {
    const rows = await db
      .select({
        studentId: attendance.studentId,
        status: attendance.status,
        moved: attendanceMovedSql,
      })
      .from(attendance)
      .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
      .where(
        and(
          eq(lessons.classId, classId),
          inArray(attendance.studentId, studentIds),
        ),
      );
    for (const r of rows) {
      const marks = marksByStudent.get(r.studentId) ?? [];
      marks.push(r);
      marksByStudent.set(r.studentId, marks);
    }
  }

  return (
    <>
      <ClassHero hub={hub} tutorId={tutor.id} />
      <GlassPanel title="Enrolled students" titleId="class-students">
        {students.length === 0 ? (
          <Empty className="py-10">
            No students enrolled yet. Admin manages enrolment.
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {students.map((s) => {
              const name = `${s.firstName} ${s.lastName}`.trim();
              const marks = marksByStudent.get(s.id) ?? [];
              const sum = attendanceSummary(marks);
              const moved = marks.filter(isMovedAbsence).length;
              const rate = sum.percent;
              const tone = rate === null ? "default" : attendanceRateTone(rate);
              return (
                <li key={s.id}>
                  <Link
                    href={`/tutor/students/${s.id}?class=${classId}`}
                    className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                  >
                    <Avatar name={name} size={36} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px] font-bold text-ink">
                        {name}
                      </span>
                      <span className="truncate text-[12px] text-muted">
                        {s.email}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      {rate === null ? (
                        <span className="text-[12px] text-muted">
                          No attendance yet
                        </span>
                      ) : (
                        <>
                          <Pill tone={tone}>{rate}% attendance</Pill>
                          <span className="hidden text-[11px] tabular-nums text-muted sm:block">
                            {[
                              `${sum.attended} attended`,
                              `${sum.absent} absent`,
                              moved > 0 ? `${moved} moved` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </GlassPanel>
    </>
  );
}
