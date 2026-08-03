"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, notifications, profiles, terms } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { requireAdmin } from "./guard";
import { isUnrestrictedStudent } from "@/lib/roles";

const schema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
});

/**
 * Issue a student's term report to their family: sends an in-app notification
 * with a link to the (role-aware) report PDF to the student - only if
 * unrestricted, matching the visibility gate - and to every linked parent.
 * Admin-only. Returns how many recipients were notified.
 */
export async function issueStudentReport(input: z.infer<typeof schema>) {
  await requireAdmin();
  const { studentId, termId } = schema.parse(input);

  const [student] = await db
    .select({
      id: profiles.id,
      role: profiles.role,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  if (!student) throw new Error("Student not found");

  const [term] = await db
    .select({ year: terms.year, termNumber: terms.termNumber })
    .from(terms)
    .where(eq(terms.id, termId))
    .limit(1);
  if (!term) throw new Error("Term not found");

  const parents = await db
    .select({ parentId: familyLinks.parentId })
    .from(familyLinks)
    .where(eq(familyLinks.studentId, studentId));

  const recipientIds = new Set<string>(parents.map((p) => p.parentId));
  // Restricted students can't view their own report - don't notify them.
  if (isUnrestrictedStudent(student.role as UserRole)) {
    recipientIds.add(studentId);
  }
  if (recipientIds.size === 0) {
    return { ok: true as const, notified: 0 };
  }

  const href = `/reports/${studentId}/${termId}`;
  const label = `${term.year} Term ${term.termNumber}`;
  await db.insert(notifications).values(
    Array.from(recipientIds).map((userId) => ({
      userId,
      channel: "in_app" as const,
      title: "Term report ready",
      body: `${label} progress report for ${student.firstName} ${student.lastName}`.trim(),
      href,
    })),
  );

  return { ok: true as const, notified: recipientIds.size };
}
