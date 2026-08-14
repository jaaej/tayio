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
import { DayPicker } from "./_components/day-picker";

type SearchParams = Promise<{ from?: string; date?: string }>;

/**
 * A URL param is only usable as a date once it is both the right shape AND a
 * date that exists: postgres rejects `2026-13-45` at query time, so the shape
 * check alone would turn a hand-edited URL into a 500. Round-tripping through
 * the parser drops anything impossible so we fall back instead of throwing.
 */
function dateParam(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== value) return null;
  return value;
}

function shiftIso(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const { from, date } = await searchParams;

  // One clock for the whole render: the cutoff and the Today/Tomorrow markers
  // must not disagree if the request straddles midnight.
  const now = new Date();

  // A picked day replaces the range entirely; otherwise: last 30 days + upcoming.
  const day = dateParam(date);
  const fromIso = dateParam(from) ?? shiftIso(now, -30);

  const relativeLabel: Record<string, string> = {
    [isoDate(now)]: "Today",
    [shiftIso(now, 1)]: "Tomorrow",
    [shiftIso(now, -1)]: "Yesterday",
  };

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
    .where(day ? eq(lessons.date, day) : gte(lessons.date, fromIso))
    .orderBy(desc(lessons.date), desc(lessons.startTime))
    .limit(200);

  // The query already orders by date, so a run-length pass is enough to build
  // the day sections and it preserves the within-day time ordering for free.
  const groups: { date: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const current = groups[groups.length - 1];
    if (current && current.date === r.date) current.rows.push(r);
    else groups.push({ date: r.date, rows: [r] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Attendance"
        title="Attendance"
      />

      <Card className="rise">
        <CardHead title="Lessons" />
        {/* The picker lives inside the table's own card, like the filter
            toolbars on /admin/users and /admin/quizzes - it controls this
            table, it is not a separate surface. It renders above the empty
            state too, so a day with no lessons is still escapable. */}
        <DayPicker />
        {groups.length === 0 ? (
          <Empty>
            {day ? "No lessons on this day." : "No lessons in this period."}
          </Empty>
        ) : (
          <div className="divide-y divide-line">
            {groups.map((group) => (
              <section key={group.date}>
                <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-5 py-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
                    {formatDateLong(group.date)}
                  </h4>
                  {relativeLabel[group.date] && (
                    <Pill tone="brand">{relativeLabel[group.date]}</Pill>
                  )}
                </div>
                <div className="divide-y divide-line">
                  {group.rows.map((r) => (
                    <Link
                      key={r.lessonId}
                      href={`/admin/attendance/${r.lessonId}`}
                      className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors"
                    >
                      {/* The date moved up into the section header, so this
                          cell narrows and the class name takes the space. */}
                      <div className="col-span-2 min-w-0">
                        <div className="text-[13px] font-bold text-ink tabular-nums">
                          {formatTime(r.startTime)} – {formatTime(r.endTime)}
                        </div>
                      </div>
                      <div className="col-span-4 min-w-0">
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
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
