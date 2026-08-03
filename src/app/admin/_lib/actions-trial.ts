"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, studentTrials } from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { coarseRole } from "@/lib/roles";
import { validateTrialRange } from "@/lib/student-trial";

const setSchema = z.object({
  studentId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(200).optional(),
});

/** Set (or replace) a student's free-trial period. Admin-only, audited. */
export async function setStudentTrial(input: z.infer<typeof setSchema>) {
  const user = await requireAdmin();
  const data = setSchema.parse(input);

  const rangeError = validateTrialRange(data.startDate, data.endDate);
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
    tx
      .insert(studentTrials)
      .values({
        studentId: data.studentId,
        startDate: data.startDate,
        endDate: data.endDate,
        note: note && note.length > 0 ? note : null,
        createdById: user.id,
      })
      .onConflictDoUpdate({
        target: studentTrials.studentId,
        set: {
          startDate: data.startDate,
          endDate: data.endDate,
          note: note && note.length > 0 ? note : null,
          createdById: user.id,
          updatedAt: sql`now()`,
        },
      }),
  );

  revalidatePath(`/admin/users/${data.studentId}`);
  return { ok: true as const };
}

/** Clear a student's free-trial period. Admin-only, audited. */
export async function clearStudentTrial(studentId: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(studentId);

  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx.delete(studentTrials).where(eq(studentTrials.studentId, studentId)),
  );

  revalidatePath(`/admin/users/${studentId}`);
  return { ok: true as const };
}
