import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  lessons,
  profiles,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/format";

type SearchParams = Promise<{ from?: string }>;

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const { from } = await searchParams;

  // Default: lessons in the last 30 days + upcoming.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const fromIso =
    from && /^\d{4}-\d{2}-\d{2}$/.test(from)
      ? from
      : cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      lessonId: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
      presentCount: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.lessonId} = ${lessons.id}
        and ${attendance.status} in ('present','makeup_attended')
      )`,
      lateCount: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.lessonId} = ${lessons.id}
        and ${attendance.status} in ('late','left_early')
      )`,
      absentCount: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.lessonId} = ${lessons.id}
        and ${attendance.status} = 'absent'
      )`,
      totalMarked: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.lessonId} = ${lessons.id}
      )`,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, lessons.tutorId))
    .where(gte(lessons.date, fromIso))
    .orderBy(desc(lessons.date), desc(lessons.startTime))
    .limit(200);

  return (
    <div className="space-y-6">
      <header className="rise">
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Attendance
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Lessons since {formatDateLong(fromIso)}. Tutors mark attendance at
          their lesson page; admin can correct here.
        </p>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between">
          <div className="text-xl font-medium text-ink">Recent lessons</div>
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            {rows.length} shown
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No lessons in this period.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {rows.map((r) => (
              <li key={r.lessonId}>
                <Link
                  href={`/admin/attendance/${r.lessonId}`}
                  className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-brand-50 transition-colors"
                >
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm text-ink">
                      {formatDateLong(r.date)}
                    </div>
                    <div className="text-xs text-muted tabular-nums">
                      {formatTime(r.startTime)} – {formatTime(r.endTime)}
                    </div>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <div className="text-sm text-ink truncate">
                      {r.className}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {r.subjectName}
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-ink-soft truncate">
                    {r.tutorFirst} {r.tutorLast}
                  </div>
                  <div className="col-span-3 flex items-center gap-2 text-xs">
                    <span className="rounded px-2 py-0.5 bg-emerald-100 text-emerald-800 tabular-nums">
                      {r.presentCount} present
                    </span>
                    {r.lateCount > 0 && (
                      <span className="rounded px-2 py-0.5 bg-amber-100 text-amber-800 tabular-nums">
                        {r.lateCount} late
                      </span>
                    )}
                    {r.absentCount > 0 && (
                      <span className="rounded px-2 py-0.5 bg-rose-100 text-rose-800 tabular-nums">
                        {r.absentCount} absent
                      </span>
                    )}
                    {r.totalMarked === 0 && (
                      <span className="text-muted">Not marked yet</span>
                    )}
                  </div>
                  <div className="col-span-1 text-right text-[11px] uppercase tracking-wide text-brand-700">
                    Edit →
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
