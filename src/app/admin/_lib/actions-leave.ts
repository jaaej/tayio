"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, studentLeave } from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { coarseRole } from "@/lib/roles";
import { validateLeaveRange } from "@/lib/student-leave";

const addSchema = z.object({
  studentId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(200).optional(),
});

/** Record a leave/holiday period for a student. Admin-only, audited. */
export async function addStudentLeave(input: z.infer<typeof addSchema>) {
  const user = await requireAdmin();
  const data = addSchema.parse(input);

  const rangeError = validateLeaveRange(data.startDate, data.endDate);
  if (rangeError) return { ok: false as const, error: rangeError };

  const [target] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, data.studentId));
  if (!target || coarseRole(target.role) !== "student") {
    return { ok: false as const, error: "That account is not a student." };
  }

  const note = data.note?.trim();
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx.insert(studentLeave).values({
      studentId: data.studentId,
      startDate: data.startDate,
      endDate: data.endDate,
      note: note && note.length > 0 ? note : null,
      createdById: user.id,
    }),
  );

  revalidatePath(`/admin/users/${data.studentId}`);
  return { ok: true as const };
}

/** Remove a leave period. Admin-only, audited. */
export async function removeStudentLeave(id: string, studentId: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);
  z.string().uuid().parse(studentId);

  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx.delete(studentLeave).where(eq(studentLeave.id, id)),
  );

  revalidatePath(`/admin/users/${studentId}`);
  return { ok: true as const };
}
