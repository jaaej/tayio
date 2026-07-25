"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { enrollments, profiles } from "@/db/schema";
import { coarseRole } from "@/lib/roles";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";

const pair = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export async function enrollStudent(input: z.infer<typeof pair>) {
  const user = await requireAdmin();
  const data = pair.parse(input);

  const [student] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.studentId));
  if (!student || coarseRole(student.role) !== "student") {
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

  await withActor({ id: user.id, role: "admin" }, async (tx) => {
    if (existing.length > 0) {
      await tx
        .update(enrollments)
        .set({ withdrawnAt: null, enrolledAt: new Date() })
        .where(
          and(
            eq(enrollments.classId, data.classId),
            eq(enrollments.studentId, data.studentId),
          ),
        );
    } else {
      await tx.insert(enrollments).values({
        classId: data.classId,
        studentId: data.studentId,
      });
    }
  });

  revalidatePath("/admin/enrolments");
  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${data.classId}`);
  return { ok: true as const };
}

export async function withdrawStudent(input: z.infer<typeof pair>) {
  const user = await requireAdmin();
  const data = pair.parse(input);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(enrollments)
      .set({ withdrawnAt: new Date() })
      .where(
        and(
          eq(enrollments.classId, data.classId),
          eq(enrollments.studentId, data.studentId),
          isNull(enrollments.withdrawnAt),
        ),
      ),
  );
  revalidatePath("/admin/enrolments");
  revalidatePath(`/admin/classes/${data.classId}`);
  return { ok: true as const };
}

const deliverySchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
  mode: z.enum(["in_person", "online"]).nullable(),
});

/**
 * Set a single student's delivery mode within a class (online vs in-person), so
 * one student can attend online while classmates attend in person. `null` clears
 * the override (falls back to the class default).
 */
export async function setDeliveryMode(input: z.infer<typeof deliverySchema>) {
  const user = await requireAdmin();
  const data = deliverySchema.parse(input);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(enrollments)
      .set({ deliveryMode: data.mode })
      .where(
        and(
          eq(enrollments.classId, data.classId),
          eq(enrollments.studentId, data.studentId),
        ),
      ),
  );
  revalidatePath(`/admin/classes/${data.classId}`);
  return { ok: true as const };
}

export async function removeEnrollment(input: z.infer<typeof pair>) {
  const user = await requireAdmin();
  const data = pair.parse(input);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .delete(enrollments)
      .where(
        and(
          eq(enrollments.classId, data.classId),
          eq(enrollments.studentId, data.studentId),
        ),
      ),
  );
  revalidatePath("/admin/enrolments");
  return { ok: true as const };
}
