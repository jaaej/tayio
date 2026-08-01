import Link from "next/link";
import { desc, eq, isNotNull } from "drizzle-orm";
import { Card, CardHead, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  profiles,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StudentsLeavingPage() {
  await requireRole("admin");

  const rows = await db
    .select({
      enrollmentId: enrollments.classId,
      studentId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
      classId: classes.id,
      className: classes.name,
      subjectName: subjects.name,
      withdrawnAt: enrollments.withdrawnAt,
    })
    .from(enrollments)
    .innerJoin(profiles, eq(profiles.id, enrollments.studentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(isNotNull(enrollments.withdrawnAt))
    .orderBy(desc(enrollments.withdrawnAt))
    .limit(200);

  // Group by student so a student withdrawn from N classes shows once with N classes listed.
  const byStudent = new Map<
    string,
    {
      studentId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      mostRecentWithdraw: Date;
      classes: Array<{
        classId: string;
        className: string;
        subjectName: string;
        withdrawnAt: Date;
      }>;
    }
  >();
  for (const r of rows) {
    if (!r.withdrawnAt) continue;
    const existing = byStudent.get(r.studentId);
    if (existing) {
      existing.classes.push({
        classId: r.classId,
        className: r.className,
        subjectName: r.subjectName,
        withdrawnAt: r.withdrawnAt,
      });
      if (r.withdrawnAt > existing.mostRecentWithdraw) {
        existing.mostRecentWithdraw = r.withdrawnAt;
      }
    } else {
      byStudent.set(r.studentId, {
        studentId: r.studentId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        mostRecentWithdraw: r.withdrawnAt,
        classes: [
          {
            classId: r.classId,
            className: r.className,
            subjectName: r.subjectName,
            withdrawnAt: r.withdrawnAt,
          },
        ],
      });
    }
  }
  const grouped = Array.from(byStudent.values()).sort(
    (a, b) => b.mostRecentWithdraw.getTime() - a.mostRecentWithdraw.getTime(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Retention"
        title="Students leaving"
        sub="Students with withdrawn enrolments. Use this list for follow-up calls or re-enrolment."
      />

      <Card className="rise">
        <CardHead
          title="Recent withdrawals"
          action={
            <Pill tone="default">
              {grouped.length} student{grouped.length === 1 ? "" : "s"}
            </Pill>
          }
        />
        {grouped.length === 0 ? (
          <Empty>No withdrawn enrolments on record.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {grouped.map((s) => (
              <li key={s.studentId} className="px-5 py-4 hover:bg-surface-2 transition-colors">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${s.studentId}`}
                      className="text-[14px] font-bold text-ink hover:text-brand-700 truncate"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    <div className="text-[12px] text-muted truncate">
                      {s.email}
                      {s.phone ? ` · ${s.phone}` : ""}
                    </div>
                  </div>
                  <div className="text-[12px] text-ink-soft tabular-nums shrink-0">
                    Last withdrew {formatDateLong(s.mostRecentWithdraw)}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {s.classes.map((c) => (
                    <li
                      key={c.classId}
                      className="flex items-center justify-between gap-3 text-[13px] text-ink-soft"
                    >
                      <Link
                        href={`/admin/classes/${c.classId}`}
                        className="hover:text-brand-700 truncate"
                      >
                        {c.subjectName} · {c.className}
                      </Link>
                      <span className="text-[12px] text-muted tabular-nums shrink-0">
                        {formatDateLong(c.withdrawnAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
