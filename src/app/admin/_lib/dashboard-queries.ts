import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  announcements,
  classes,
  enrollments,
  invoices,
  lessonNotes,
  lessons,
  profiles,
  rescheduleRequests,
  subjects,
  tutorWeeklyCheckins,
} from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { inclusiveDayCount, melbourneDate } from "@/lib/tutor-cover-rules";

/*
 * Data for the admin dashboard's To do, Revenue, and Students to watch cards.
 * Each to-do item is a real backlog the admin can act on from one linked page;
 * an item with nothing outstanding is omitted rather than shown as zero.
 */

export type TodoKind =
  | "attendance"
  | "overdue"
  | "reschedules"
  | "announcements"
  | "checkins"
  | "notes";

export type TodoItem = {
  kind: TodoKind;
  title: string;
  detail: string;
  action: string;
  href: string;
};

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Melbourne wall-clock time as HH:MM:SS - servers run in UTC. */
function melbourneTime(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export async function getDashboardTodo(
  now: Date,
  opts: { showMoney: boolean; isOwner: boolean },
): Promise<TodoItem[]> {
  const todayIso = melbourneDate(now);
  const nowTime = melbourneTime(now);
  const lookbackIso = addIsoDays(todayIso, -14);
  const lastWeekStart = weekStartForIsoDate(addIsoDays(todayIso, -7));

  const [unmarked, overdue, reschedules, pendingNotices, checkins, notes] =
    await Promise.all([
      // Finished lessons in the last fortnight with enrolled students but no
      // attendance rows at all.
      db
        .select({
          count: sql<number>`count(*)::int`,
          oldest: sql<string | null>`min(${lessons.date})::text`,
        })
        .from(lessons)
        .where(
          and(
            inArray(lessons.status, ["upcoming", "completed", "makeup"]),
            gte(lessons.date, lookbackIso),
            sql`(${lessons.date} < ${todayIso} or (${lessons.date} = ${todayIso} and ${lessons.endTime} <= ${nowTime}))`,
            sql`not exists (select 1 from attendance a where a.lesson_id = ${lessons.id})`,
            sql`exists (select 1 from enrollments e where e.class_id = ${lessons.classId} and e.withdrawn_at is null)`,
          ),
        ),
      db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
          oldest: sql<string | null>`min(${invoices.dueDate})::text`,
        })
        .from(invoices)
        .where(
          and(
            sql`${invoices.status} in ('unpaid','overdue','partially_paid')`,
            lt(invoices.dueDate, todayIso),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(rescheduleRequests)
        .where(eq(rescheduleRequests.status, "pending")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(announcements)
        .where(eq(announcements.status, "pending")),
      opts.isOwner
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(tutorWeeklyCheckins)
            .where(
              and(
                eq(tutorWeeklyCheckins.weekStart, lastWeekStart),
                inArray(tutorWeeklyCheckins.status, ["pending", "disputed"]),
              ),
            )
        : Promise.resolve([{ count: 0 }]),
      db
        .select({
          tutors: sql<number>`count(distinct ${lessons.tutorId})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(lessons)
        .leftJoin(lessonNotes, eq(lessonNotes.lessonId, lessons.id))
        .where(
          and(
            eq(lessons.status, "completed"),
            gte(lessons.date, lookbackIso),
            lt(lessons.date, todayIso),
            isNull(lessonNotes.id),
          ),
        ),
    ]);

  const items: TodoItem[] = [];

  const u = unmarked[0];
  if (u && u.count > 0) {
    items.push({
      kind: "attendance",
      title: `${plural(u.count, "lesson")} need${u.count === 1 ? "s" : ""} attendance marked`,
      detail: u.oldest ? `Oldest is from ${shortDate(u.oldest)}` : "From the last two weeks",
      action: "Mark now",
      href: "/admin/attendance",
    });
  }

  const o = overdue[0];
  if (o && o.count > 0) {
    const late = o.oldest ? inclusiveDayCount(o.oldest, todayIso) - 1 : 0;
    const total = Number(o.total).toLocaleString("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    });
    items.push({
      kind: "overdue",
      title: `${plural(o.count, "invoice")} ${o.count === 1 ? "is" : "are"} overdue`,
      // Reception without the PIN never receives money figures.
      detail: opts.showMoney
        ? `${total} total · oldest ${plural(late, "day")} late`
        : `Oldest ${plural(late, "day")} late`,
      action: "Review",
      href: "/admin/payments",
    });
  }

  const r = reschedules[0];
  if (r && r.count > 0) {
    items.push({
      kind: "reschedules",
      title: `${plural(r.count, "reschedule request")} waiting`,
      detail: "Families are waiting for an answer",
      action: "Review",
      href: "/admin/reschedules",
    });
  }

  const a = pendingNotices[0];
  if (a && a.count > 0) {
    items.push({
      kind: "announcements",
      title: `${plural(a.count, "tutor announcement")} to approve`,
      detail: "Not visible to families until approved",
      action: "Review",
      href: "/admin/announcements",
    });
  }

  const c = checkins[0];
  if (c && c.count > 0) {
    items.push({
      kind: "checkins",
      title: `${plural(c.count, "tutor")} still to approve last week's hours`,
      detail: "Payroll uses approved check-ins only",
      action: "Open",
      href: `/admin/tutor-checkins?week=${lastWeekStart}`,
    });
  }

  const n = notes[0];
  if (n && n.count > 0) {
    items.push({
      kind: "notes",
      title: `${plural(n.count, "lesson")} without notes`,
      detail: `From ${plural(n.tutors, "tutor")} in the last two weeks`,
      action: "View",
      href: "/admin/attendance",
    });
  }

  return items;
}

export type MonthRevenue = { key: string; label: string; total: number };

/** Paid invoice totals by month paid, oldest first, ending with this month. */
export async function getMonthlyRevenue(
  now: Date,
  months = 6,
): Promise<MonthRevenue[]> {
  // Month boundaries follow Melbourne, matching how the business reports.
  const [year, month] = melbourneDate(now).split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1 - (months - 1), 1));
  const rows = await db
    .select({
      key: sql<string>`to_char(date_trunc('month', ${invoices.paidAt} at time zone 'Australia/Melbourne'), 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${invoices.amount}), 0)::text`,
    })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), gte(invoices.paidAt, start)))
    .groupBy(sql`1`);
  const byKey = new Map(rows.map((row) => [row.key, Number(row.total)]));

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: d.toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" }),
      total: byKey.get(key) ?? 0,
    };
  });
}

export type StudentToWatch = {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string | null;
  reason: string;
  tone: "bad" | "warn";
};

/**
 * Students with a concrete warning sign: repeated absences across their last
 * four marked lessons, or homework still outstanding. Absences rank first
 * because they are the earlier signal of a family drifting away.
 */
export async function getStudentsToWatch(limit = 5): Promise<StudentToWatch[]> {
  const absenceRows = await db.execute<{
    student_id: string;
    absent: number;
    marked: number;
  }>(sql`
    select student_id,
           count(*) filter (where status = 'absent')::int as absent,
           count(*)::int as marked
    from (
      select a.student_id, a.status,
             row_number() over (partition by a.student_id order by l.date desc, l.start_time desc) as rn
      from attendance a
      join lessons l on l.id = a.lesson_id
    ) recent
    where rn <= 4
    group by student_id
    having count(*) filter (where status = 'absent') >= 2
    order by absent desc
    limit ${limit}
  `);

  const homeworkRows = await db.execute<{ student_id: string; pending: number }>(sql`
    select ha.student_id, count(*)::int as pending
    from homework_assignments ha
    join homework h on h.id = ha.homework_id
    where ha.status in ('not_started','viewed','late','resubmission_requested')
      and h.due_date < now()
    group by ha.student_id
    having count(*) >= 2
    order by pending desc
    limit ${limit}
  `);

  const reasons = new Map<string, { reason: string; tone: "bad" | "warn" }>();
  for (const row of absenceRows) {
    reasons.set(row.student_id, {
      reason: `Missed ${row.absent} of last ${row.marked} lessons`,
      tone: "bad",
    });
  }
  for (const row of homeworkRows) {
    if (reasons.has(row.student_id)) continue;
    reasons.set(row.student_id, {
      reason: `${row.pending} homework tasks overdue`,
      tone: "warn",
    });
  }
  const ids = [...reasons.keys()].slice(0, limit);
  if (ids.length === 0) return [];

  const [people, classRows] = await Promise.all([
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(and(inArray(profiles.id, ids), eq(profiles.isActive, true))),
    db
      .select({
        studentId: enrollments.studentId,
        className: classes.name,
        subjectName: subjects.name,
      })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(inArray(enrollments.studentId, ids), isNull(enrollments.withdrawnAt)),
      )
      .orderBy(asc(subjects.name)),
  ]);

  const classByStudent = new Map<string, string>();
  for (const row of classRows) {
    if (!classByStudent.has(row.studentId)) {
      classByStudent.set(
        row.studentId,
        classDisplayName(row.subjectName, row.className),
      );
    }
  }
  const personById = new Map(people.map((p) => [p.id, p]));

  return ids.flatMap((id) => {
    const person = personById.get(id);
    const why = reasons.get(id);
    if (!person || !why) return [];
    return [
      {
        studentId: id,
        firstName: person.firstName,
        lastName: person.lastName,
        className: classByStudent.get(id) ?? null,
        ...why,
      },
    ];
  });
}
