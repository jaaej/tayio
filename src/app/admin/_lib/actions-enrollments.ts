"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { enrollments, profiles } from "@/db/schema";
import { requireAdmin } from "./guard";

const pair = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export async function enrollStudent(input: z.infer<typeof pair>) {
  await requireAdmin();
  const data = pair.parse(input);

  const [student] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.studentId));
  if (!student || student.role !== "student") {
    return { ok: false as const, error: "Student account not found" };
  }

  // If row exists (maybe withdrawn), re-activate; else insert.
  const existing = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.classId, data.classId),
        eq(enrollments.studentId, data.studentId),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(enrollments)
      .set({ withdrawnAt: null, enrolledAt: new Date() })
      .where(
        and(
          eq(enrollments.classId, data.classId),
          eq(enrollments.studentId, data.studentId),
        ),
      );
  } else {
    await db.insert(enrollments).values({
      classId: data.classId,
      studentId: data.studentId,
    });
  }

  revalidatePath("/admin/enrolments");
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function withdrawStudent(input: z.infer<typeof pair>) {
  await requireAdmin();
  const data = pair.parse(input);
  await db
    .update(enrollments)
    .set({ withdrawnAt: new Date() })
    .where(
      and(
        eq(enrollments.classId, data.classId),
        eq(enrollments.studentId, data.studentId),
        isNull(enrollments.withdrawnAt),
      ),
    );
  revalidatePath("/admin/enrolments");
  return { ok: true as const };
}

export async function removeEnrollment(input: z.infer<typeof pair>) {
  await requireAdmin();
  const data = pair.parse(input);
  await db
    .delete(enrollments)
    .where(
      and(
        eq(enrollments.classId, data.classId),
        eq(enrollments.studentId, data.studentId),
      ),
    );
  revalidatePath("/admin/enrolments");
  return { ok: true as const };
}
