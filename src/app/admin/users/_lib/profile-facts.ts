import "server-only";

import { and, countDistinct, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, enrollments, invoices } from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { formatDateLong } from "@/lib/format";
import { OPEN_INVOICE_STATUSES, isInvoiceOverdue } from "@/lib/invoice-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";

export type QuickFact = {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
  href?: string;
};

/** The family's card in Payments (the search matches the parent's email). */
function paymentsHref(email: string, overdue: boolean): string {
  const params = new URLSearchParams({ q: email });
  if (overdue) params.set("status", "overdue");
  return `/admin/payments?${params.toString()}`;
}

/** A parent's open invoices, overdue by the shared invoice rule. */
async function parentInvoiceFact(
  parentId: string,
  email: string,
  today: string,
): Promise<QuickFact> {
  const open = await db
    .select({ status: invoices.status, dueDate: invoices.dueDate })
    .from(invoices)
    .where(
      and(eq(invoices.parentId, parentId), inArray(invoices.status, [...OPEN_INVOICE_STATUSES])),
    );

  if (open.length === 0) {
    return { label: "Invoices", value: "Paid up", href: paymentsHref(email, false) };
  }

  const overdue = open
    .filter((row) => isInvoiceOverdue(row, today))
    .map((row) => row.dueDate)
    .sort();
  if (overdue.length > 0) {
    return {
      label: "Invoices",
      value: `${overdue.length} overdue`,
      sub: `since ${formatDateLong(overdue[0])}`,
      tone: "bad",
      href: paymentsHref(email, true),
    };
  }
  const nextDue = open.map((row) => row.dueDate).sort()[0];
  return {
    label: "Invoices",
    value: `${open.length} open`,
    sub: `next due ${formatDateLong(nextDue)}`,
    href: paymentsHref(email, false),
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
  email: string,
): Promise<QuickFact[]> {
  const today = melbourneDate(new Date());
  switch (coarseRole(role)) {
    case "tutor":
      return tutorFacts(id);
    case "parent":
      return [await parentInvoiceFact(id, email, today)];
    default:
      return [];
  }
}
