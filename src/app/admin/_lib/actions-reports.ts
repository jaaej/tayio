"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { terms } from "@/db/schema";
import { requireAdmin } from "./guard";
import { getTermReportRoster, issueTermReport } from "./term-reports";

const schema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
});

/**
 * Issue a student's term report to their family: an in-app notification
 * with a link to the (role-aware) report PDF goes to every linked parent,
 * and to the student only if unrestricted, matching the visibility gate.
 * Recorded as sent. Admin-only. Returns how many recipients were notified.
 */
export async function issueStudentReport(input: z.infer<typeof schema>) {
  const admin = await requireAdmin();
  const { studentId, termId } = schema.parse(input);
  const { notified } = await issueTermReport(studentId, termId, admin.id);
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/users/${studentId}`);
  return { ok: true as const, notified };
}

const classSchema = z.object({
  termId: z.string().uuid(),
  classId: z.string().uuid(),
});

/**
 * Issue the term report to every student in a class who has not had theirs
 * and has someone to send it to. Each student is issued on its own, so one
 * failure leaves the others sent; the counts say what happened.
 */
export async function issueClassTermReports(input: z.infer<typeof classSchema>) {
  const admin = await requireAdmin();
  const parsed = classSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose a term and a class." };
  const { termId, classId } = parsed.data;

  const [term] = await db
    .select({
      id: terms.id,
      year: terms.year,
      termNumber: terms.termNumber,
      startDate: terms.startDate,
      endDate: terms.endDate,
    })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1);
  if (!term) return { ok: false as const, error: "That term no longer exists." };

  const roster = await getTermReportRoster(term, classId);
  const toIssue = roster.filter((s) => s.issuedAt === null && s.recipients > 0);
  let issued = 0;
  let failed = 0;
  for (const student of toIssue) {
    try {
      const { notified } = await issueTermReport(student.id, termId, admin.id);
      if (notified > 0) issued += 1;
    } catch (error) {
      failed += 1;
      console.error("[term-reports] issue failed", student.id, error);
    }
  }
  revalidatePath("/admin/reports");
  return { ok: true as const, issued, failed };
}
