"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  profiles,
  studentCurriculumTermGrants,
  subjectWeeks,
  terms,
} from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import {
  findCurriculumEntryTerm,
  melbourneDateKey,
} from "@/lib/curriculum-access-rules";
import { withActor } from "@/lib/with-actor";
import { requireAdmin } from "./guard";

const accessInput = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
});

async function validateHistoricalGrant(input: z.infer<typeof accessInput>) {
  const [[student], active, firstEnrollment, subjectTermRows] =
    await Promise.all([
      db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, input.studentId))
        .limit(1),
      db
        .select({ id: classes.id })
        .from(enrollments)
        .innerJoin(classes, eq(classes.id, enrollments.classId))
        .where(
          and(
            eq(enrollments.studentId, input.studentId),
            eq(classes.subjectId, input.subjectId),
            isNull(enrollments.withdrawnAt),
          ),
        )
        .limit(1),
      db
        .select({ enrolledAt: enrollments.enrolledAt })
        .from(enrollments)
        .innerJoin(classes, eq(classes.id, enrollments.classId))
        .where(
          and(
            eq(enrollments.studentId, input.studentId),
            eq(classes.subjectId, input.subjectId),
          ),
        )
        .orderBy(asc(enrollments.enrolledAt))
        .limit(1),
      db
        .selectDistinct({
          id: terms.id,
          year: terms.year,
          termNumber: terms.termNumber,
          startDate: terms.startDate,
          endDate: terms.endDate,
        })
        .from(subjectWeeks)
        .innerJoin(terms, eq(terms.id, subjectWeeks.termId))
        .where(eq(subjectWeeks.subjectId, input.subjectId)),
    ]);

  if (!student || coarseRole(student.role) !== "student") {
    return { ok: false as const, error: "Student account not found." };
  }
  if (active.length === 0 || firstEnrollment.length === 0) {
    return { ok: false as const, error: "Student is not enrolled in this subject." };
  }

  const requested = subjectTermRows.find((term) => term.id === input.termId);
  const entry = findCurriculumEntryTerm(
    subjectTermRows,
    melbourneDateKey(firstEnrollment[0].enrolledAt),
  );
  if (!requested || !entry || requested.startDate >= entry.startDate) {
    return { ok: false as const, error: "Only an earlier term can be granted manually." };
  }
  if (requested.startDate > melbourneDateKey()) {
    return { ok: false as const, error: "Future terms cannot be unlocked early." };
  }
  return { ok: true as const };
}
export async function grantCurriculumTermAccess(
  input: z.infer<typeof accessInput>,
) {
  const admin = await requireAdmin();
  const data = accessInput.parse(input);
  const valid = await validateHistoricalGrant(data);
  if (!valid.ok) return valid;

  await withActor({ id: admin.id, role: "admin" }, (tx) =>
    tx
      .insert(studentCurriculumTermGrants)
      .values({ ...data, grantedById: admin.id })
      .onConflictDoNothing(),
  );
  revalidatePath(`/admin/users/${data.studentId}`);
  revalidatePath(`/student/subjects/${data.subjectId}`);
  revalidatePath(`/parent/subjects/${data.subjectId}`);
  return { ok: true as const };
}

export async function revokeCurriculumTermAccess(
  input: z.infer<typeof accessInput>,
) {
  const admin = await requireAdmin();
  const data = accessInput.parse(input);
  await withActor({ id: admin.id, role: "admin" }, (tx) =>
    tx
      .delete(studentCurriculumTermGrants)
      .where(
        and(
          eq(studentCurriculumTermGrants.studentId, data.studentId),
          eq(studentCurriculumTermGrants.subjectId, data.subjectId),
          eq(studentCurriculumTermGrants.termId, data.termId),
        ),
      ),
  );
  revalidatePath(`/admin/users/${data.studentId}`);
  revalidatePath(`/student/subjects/${data.subjectId}`);
  revalidatePath(`/parent/subjects/${data.subjectId}`);
  return { ok: true as const };
}
