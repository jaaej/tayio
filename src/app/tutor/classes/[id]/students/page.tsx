import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { Avatar, Empty, GlassPanel, Pill } from "@/components/admin/ui";
import { db } from "@/db/client";
import { attendance, enrollments, lessons, profiles } from "@/db/schema";
import { requireTutor } from "@/app/tutor/_data";
import { getClassHub } from "../_lib/class-hub";

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
  const summaries = new Map<
    string,
    { present: number; late: number; absent: number; total: number }
  >();

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
    <GlassPanel title="Enrolled students" titleId="class-students">
      {students.length === 0 ? (
        <Empty className="py-10">
          No students enrolled yet. Admin manages enrolment.
        </Empty>
      ) : (
        <ul className="divide-y divide-line">
          {students.map((s) => {
            const name = `${s.firstName} ${s.lastName}`.trim();
            const sum = summaries.get(s.id);
            const rate =
              sum && sum.total > 0
                ? Math.round(((sum.present + sum.late) / sum.total) * 100)
                : null;
            const tone =
              rate === null
                ? "default"
                : rate >= 90
                  ? "good"
                  : rate >= 70
                    ? "warn"
                    : "bad";
            return (
              <li key={s.id}>
                <Link
                  href={`/tutor/students/${s.id}`}
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
                          {sum!.present} present · {sum!.late} late ·{" "}
                          {sum!.absent} absent
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
  );
}
