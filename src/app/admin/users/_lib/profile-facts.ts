import "server-only";

import { and, countDistinct, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, invoices } from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { formatDateLong } from "@/lib/format";
import { melbourneDate } from "@/lib/tutor-cover-rules";

export type QuickFact = {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
};

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
 * straight from stored records; admins and students get none (the owner
 * removed a student's attendance, homework, invoice and credit tiles on
 * 18 October 2026: those live in the profile's tabs).
 */
export async function getProfileFacts(
  id: string,
  role: UserRole,
): Promise<QuickFact[]> {
  const today = melbourneDate(new Date());
  switch (coarseRole(role)) {
    case "tutor":
      return tutorFacts(id);
    case "parent":
      return [await invoiceFact(invoices.parentId, id, today)];
    default:
      return [];
  }
}
