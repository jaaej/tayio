import "server-only";
import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, invoices, profiles, subjects } from "@/db/schema";
import { classDisplayName } from "@/lib/class-display";
import { inclusiveDayCount, melbourneDate } from "@/lib/tutor-cover-rules";
import { getAdminQueues } from "./admin-queues";
import { rankWatchList } from "./watch-rules";
import { getWatchSignals } from "./watch-signals";

/*
 * Data for the admin dashboard's To do, Revenue, and Students to watch cards.
 * Each to-do item is a real backlog the admin can act on from one linked page,
 * counted by the same function that page (or its sidebar badge) uses; an item
 * with nothing outstanding is omitted rather than shown as zero.
 */

export type TodoKind =
  | "cover"
  | "attendance"
  | "notes"
  | "leave"
  | "class_moves"
  | "quizzes"
  | "announcements"
  | "overdue"
  | "checkins";

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

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/** One row per live queue, most time-critical first. */
export async function getDashboardTodo(
  now: Date,
  opts: { showMoney: boolean; isOwner: boolean },
): Promise<TodoItem[]> {
  const todayIso = melbourneDate(now);
  const q = await getAdminQueues(now, { isOwner: opts.isOwner });
  const items: TodoItem[] = [];

  const cover = q.coverLeave;
  if (cover.coverOpen > 0) {
    items.push({
      kind: "cover",
      title: `${plural(cover.coverOpen, "lesson")} need${cover.coverOpen === 1 ? "s" : ""} a cover tutor`,
      detail:
        cover.coverSoon > 0
          ? `${cover.coverSoon} start${cover.coverSoon === 1 ? "s" : ""} within 48 hours`
          : `Soonest is ${shortDate(cover.coverNext ?? todayIso)}`,
      action: "Assign",
      href: "/admin/reschedules",
    });
  }

  const marking = q.backlog.toMark;
  if (marking.count > 0 && marking.oldest) {
    items.push({
      kind: "attendance",
      title: `${plural(marking.count, "lesson")} need${marking.count === 1 ? "s" : ""} attendance marked`,
      detail: `Oldest is from ${shortDate(marking.oldest)}`,
      action: "Mark now",
      // From the oldest, so the queue lists exactly these lessons.
      href: `/admin/attendance?from=${marking.oldest}`,
    });
  }

  const notes = q.backlog.notes;
  if (notes.count > 0 && notes.oldest) {
    items.push({
      kind: "notes",
      title: `${plural(notes.count, "lesson")} without notes`,
      detail: `From ${plural(notes.tutors, "tutor")} · oldest ${shortDate(notes.oldest)}`,
      action: "View",
      href: "/admin/attendance?view=notes",
    });
  }

  if (cover.leavePending > 0) {
    items.push({
      kind: "leave",
      title: `${plural(cover.leavePending, "leave request")} to approve`,
      detail: `Earliest starts ${shortDate(cover.leaveNext ?? todayIso)}`,
      action: "Review",
      href: "/admin/reschedules?tab=leave",
    });
  }

  if (cover.classMovesPending > 0) {
    items.push({
      kind: "class_moves",
      title: `${plural(cover.classMovesPending, "class move request")} waiting`,
      detail: "Families are waiting for an answer",
      action: "Review",
      href: "/admin/reschedules?tab=moves",
    });
  }

  if (q.quizzes.count > 0) {
    items.push({
      kind: "quizzes",
      title: `${plural(q.quizzes.count, "quiz", "quizzes")} to review`,
      detail: q.quizzes.oldest
        ? `Oldest sent ${shortDate(melbourneDate(q.quizzes.oldest))}`
        : "Sent by tutors",
      action: "Review",
      href: "/admin/quizzes?status=pending_review",
    });
  }

  if (q.announcements > 0) {
    items.push({
      kind: "announcements",
      title: `${plural(q.announcements, "tutor announcement")} to approve`,
      detail: "Not visible to families until approved",
      action: "Review",
      href: "/admin/announcements",
    });
  }

  const o = q.overdue;
  if (o.count > 0 && o.oldestDue) {
    const late = inclusiveDayCount(o.oldestDue, todayIso) - 1;
    const total = o.total.toLocaleString("en-AU", {
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
      href: "/admin/payments?status=overdue",
    });
  }

  if (q.checkins.count > 0) {
    items.push({
      kind: "checkins",
      title: `${plural(q.checkins.count, "tutor")} still to approve last week's hours`,
      detail: "Payroll uses approved check-ins only",
      action: "Open",
      href: `/admin/tutor-checkins?week=${q.checkins.weekStart}`,
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
 * Students with a concrete warning sign (the shared watch rules): repeated
 * absences across their last four counted lessons, or homework overdue.
 * Absences rank first because they are the earlier signal of a family
 * drifting away.
 */
export async function getStudentsToWatch(limit = 5): Promise<StudentToWatch[]> {
  // Ranked in full, then trimmed after deactivated accounts drop out, so the
  // list still fills up to `limit`.
  const ranked = rankWatchList(await getWatchSignals(), Number.POSITIVE_INFINITY);
  const reasons = new Map(ranked.map((r) => [r.studentId, r.why]));
  const ids = [...reasons.keys()];
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

  return ids
    .flatMap((id) => {
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
    })
    .slice(0, limit);
}
