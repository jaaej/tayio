import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { ChevronRight } from "lucide-react";
import { Card, CardHead, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { db } from "@/db/client";
import {
  attendance,
  classes,
  lessons,
  profiles,
  subjects,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong, formatTime, isoDate } from "@/lib/format";

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
      : isoDate(cutoff);

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
      <PageHeader
        className="rise"
        eyebrow="Attendance"
        title="Attendance"
        sub={`Lessons since ${formatDateLong(fromIso)}. Tutors mark attendance at their lesson page; admin can correct here.`}
      />

      <Card className="rise">
        <CardHead
          title="Recent lessons"
          action={<Pill tone="brand">{rows.length} shown</Pill>}
        />
        {rows.length === 0 ? (
          <Empty>No lessons in this period.</Empty>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <Link
                key={r.lessonId}
                href={`/admin/attendance/${r.lessonId}`}
                className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors"
              >
                <div className="col-span-3 min-w-0">
                  <div className="text-[14px] font-bold text-ink truncate">
                    {formatDateLong(r.date)}
                  </div>
                  <div className="text-[12px] text-muted tabular-nums mt-0.5">
                    {formatTime(r.startTime)} – {formatTime(r.endTime)}
                  </div>
                </div>
                <div className="col-span-3 min-w-0">
                  <div className="text-[13px] text-ink truncate">
                    {r.className}
                  </div>
                  <div className="text-[12px] text-muted truncate mt-0.5">
                    {r.subjectName}
                  </div>
                </div>
                <div className="col-span-2 text-[13px] text-ink-soft truncate">
                  {r.tutorFirst} {r.tutorLast}
                </div>
                <div className="col-span-3 flex flex-wrap items-center gap-1.5">
                  <Pill tone="good">{r.presentCount} present</Pill>
                  {r.lateCount > 0 && (
                    <Pill tone="warn">{r.lateCount} late</Pill>
                  )}
                  {r.absentCount > 0 && (
                    <Pill tone="bad">{r.absentCount} absent</Pill>
                  )}
                  {r.totalMarked === 0 && (
                    <span className="text-[12px] text-muted">
                      Not marked yet
                    </span>
                  )}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-1 text-[11px] uppercase tracking-[0.14em] font-bold text-brand-700">
                  Edit
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
