import Link from "next/link";
import { desc, eq, isNotNull } from "drizzle-orm";
import { Card } from "@/components/ui/card";
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
      <header className="rise">
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Students Leaving
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Students with withdrawn enrolments. Use this list for follow-up
          calls or re-enrolment.
        </p>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between">
          <div className="text-xl font-medium text-ink">Recent withdrawals</div>
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            {grouped.length} student{grouped.length === 1 ? "" : "s"}
          </span>
        </div>
        {grouped.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No withdrawn enrolments on record.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {grouped.map((s) => (
              <li key={s.studentId} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${s.studentId}`}
                      className="text-base text-ink hover:text-brand-700 truncate"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    <div className="text-xs text-muted truncate">
                      {s.email}
                      {s.phone ? ` · ${s.phone}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-ink-soft tabular-nums shrink-0">
                    Last withdrew {formatDateLong(s.mostRecentWithdraw)}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {s.classes.map((c) => (
                    <li
                      key={c.classId}
                      className="flex items-center justify-between gap-3 text-sm text-ink-soft"
                    >
                      <Link
                        href={`/admin/classes/${c.classId}`}
                        className="hover:text-brand-700 truncate"
                      >
                        {c.subjectName} · {c.className}
                      </Link>
                      <span className="text-xs text-muted tabular-nums shrink-0">
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
