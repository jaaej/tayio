import "server-only";

import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { db } from "@/db/client";
import { enrollments, profiles } from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import { melbourneDate } from "@/lib/tutor-cover-rules";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Students joining and leaving a class in one save. */
export type StudentChanges = { add: string[]; withdraw: string[] };

/** A student to add no longer has a student account. */
export class NotAStudent extends Error {}

/**
 * Apply a class's student changes inside the caller's transaction: a joining
 * student is enrolled (or re-enrolled after leaving), and a leaving one is
 * withdrawn from today (attendance and notes are kept, and they stay on the
 * rolls of lessons before today). New class and the subject
 * page's class cards both save students through this.
 */
export async function applyStudentChanges(tx: DbTx, classId: string, changes: StudentChanges) {
  if (changes.add.length > 0) {
    const accounts = await tx
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(inArray(profiles.id, changes.add));
    const students = new Set(
      accounts.filter((a) => coarseRole(a.role) === "student").map((a) => a.id),
    );
    if (changes.add.some((id) => !students.has(id))) throw new NotAStudent();

    const existing = await tx
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(and(eq(enrollments.classId, classId), inArray(enrollments.studentId, changes.add)));
    const known = new Set(existing.map((e) => e.studentId));
    const rejoining = changes.add.filter((id) => known.has(id));
    const joining = changes.add.filter((id) => !known.has(id));
    if (rejoining.length > 0) {
      await tx
        .update(enrollments)
        .set({ withdrawnAt: null, endsOn: null, enrolledAt: new Date() })
        .where(
          and(
            eq(enrollments.classId, classId),
            inArray(enrollments.studentId, rejoining),
            isNotNull(enrollments.withdrawnAt),
          ),
        );
    }
    if (joining.length > 0) {
      await tx
        .insert(enrollments)
        .values(joining.map((studentId) => ({ classId, studentId })));
    }
  }

  if (changes.withdraw.length > 0) {
    // Off the rolls from today; still on the lessons before it.
    const now = new Date();
    await tx
      .update(enrollments)
      .set({ withdrawnAt: now, endsOn: melbourneDate(now) })
      .where(
        and(
          eq(enrollments.classId, classId),
          inArray(enrollments.studentId, changes.withdraw),
          isNull(enrollments.withdrawnAt),
        ),
      );
  }
}
