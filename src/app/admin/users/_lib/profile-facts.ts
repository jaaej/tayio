import "server-only";

import { and, countDistinct, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attendance,
  classCredits,
  classes,
  enrollments,
  homework,
  homeworkAssignments,
  invoices,
  lessons,
} from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { formatDateLong } from "@/lib/format";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";

export type QuickFact = {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
};

const WINDOW_DAYS = 30;
const ATTENDED = ["present", "late", "left_early", "makeup_attended"] as const;
const SUBMITTED = ["submitted", "marked", "returned"] as const;
const OPEN_INVOICE = ["unpaid", "overdue", "partially_paid"] as const;

/** Open invoices for a student (their own) or a parent (the family's). */
async function invoiceFact(
  column: typeof invoices.studentId | typeof invoices.parentId,
  id: string,
  today: string,
): Promise<QuickFact> {
  const open = await db
    .select({ status: invoices.status, dueDate: invoices.dueDate })
    .from(invoices)
    .where(and(eq(column, id), inArray(invoices.status, [...OPEN_INVOICE])));

  if (open.length === 0) return { label: "Invoices", value: "Paid up" };

  const overdue = open
    .filter((row) => row.status === "overdue" || row.dueDate < today)
    .map((row) => row.dueDate)
    .sort();
  if (overdue.length > 0) {
    return {
      label: "Invoices",
      value: `${overdue.length} overdue`,
      sub: `since ${formatDateLong(overdue[0])}`,
      tone: "bad",
    };
  }
  const nextDue = open.map((row) => row.dueDate).sort()[0];
  return {
    label: "Invoices",
    value: `${open.length} open`,
    sub: `next due ${formatDateLong(nextDue)}`,
  };
}

async function studentFacts(id: string, today: string): Promise<QuickFact[]> {
  const from = addIsoDays(today, -WINDOW_DAYS);
  const [[att], [hw], [credits], invoice] = await Promise.all([
    db
      .select({
        marked: sql<number>`count(*)::int`,
        attended: sql<number>`count(*) filter (where ${inArray(attendance.status, [...ATTENDED])})::int`,
      })
      .from(attendance)
      .innerJoin(lessons, eq(lessons.id, attendance.lessonId))
      .where(
        and(
          eq(attendance.studentId, id),
          gte(lessons.date, from),
          lte(lessons.date, today),
        ),
      ),
    db
      .select({
        due: sql<number>`count(*)::int`,
        submitted: sql<number>`count(*) filter (where ${inArray(homeworkAssignments.status, [...SUBMITTED])})::int`,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .where(
        and(
          eq(homeworkAssignments.studentId, id),
          sql`${homework.dueDate} >= now() - make_interval(days => ${WINDOW_DAYS})`,
          sql`${homework.dueDate} < now()`,
        ),
      ),
    db
      .select({ available: sql<number>`count(*)::int` })
      .from(classCredits)
      .where(
        and(
          eq(classCredits.studentId, id),
          eq(classCredits.status, "active"),
          gte(classCredits.expiresAt, today),
        ),
      ),
    invoiceFact(invoices.studentId, id, today),
  ]);

  const rate = att.marked > 0 ? Math.round((att.attended / att.marked) * 100) : null;
  return [
    {
      label: "Attendance",
      value: rate === null ? "-" : `${rate}%`,
      sub: "last 30 days",
      tone: rate !== null && rate < 75 ? "bad" : "default",
    },
    {
      label: "Homework",
      value: hw.due === 0 ? "-" : `${hw.submitted} of ${hw.due}`,
      sub: hw.due === 0 ? "none due, last 30 days" : "submitted, last 30 days",
      tone: hw.due > 0 && hw.submitted < hw.due ? "warn" : "default",
    },
    invoice,
    {
      label: "Credits",
      value: String(credits.available),
      sub: "make-up available",
    },
  ];
}

async function tutorFacts(id: string): Promise<QuickFact[]> {
  const [[classCount], [students]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(classes)
      .where(eq(classes.tutorId, id)),
    db
      .select({ n: countDistinct(enrollments.studentId) })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(and(eq(classes.tutorId, id), isNull(enrollments.withdrawnAt))),
  ]);
  return [
    { label: "Classes", value: String(classCount.n) },
    { label: "Students", value: String(students.n), sub: "currently enrolled" },
  ];
}

/**
 * The quick-fact tiles on a profile. Only facts that fit the role and come
 * straight from stored records; admins get none.
 */
export async function getProfileFacts(
  id: string,
  role: UserRole,
): Promise<QuickFact[]> {
  const today = melbourneDate(new Date());
  switch (coarseRole(role)) {
    case "student":
      return studentFacts(id, today);
    case "tutor":
      return tutorFacts(id);
    case "parent":
      return [await invoiceFact(invoices.parentId, id, today)];
    default:
      return [];
  }
}
