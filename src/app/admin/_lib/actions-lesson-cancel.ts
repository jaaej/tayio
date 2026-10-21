"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelLessonForEveryone, getCancelImpact, type CancelImpact } from "@/lib/lesson-cancel";
import { requireAdmin } from "./guard";

const idSchema = z.string().uuid();

/** Who cancelling the lesson affects, for its confirmation. */
export async function getLessonCancelPreview(
  lessonId: string,
): Promise<{ ok: true; impact: CancelImpact } | { ok: false; error: string }> {
  await requireAdmin();
  const impact = await getCancelImpact(idSchema.parse(lessonId));
  return impact ? { ok: true, impact } : { ok: false, error: "This lesson no longer exists." };
}

/**
 * Cancel a lesson for everyone (no tutor could take it): each student it was
 * for gets a class credit, and students, parents and tutors are told.
 */
export async function cancelLessonForAll(lessonId: string) {
  const admin = await requireAdmin();
  const result = await cancelLessonForEveryone(idSchema.parse(lessonId), admin.id);
  if (result.ok) {
    revalidatePath("/admin", "layout");
    revalidatePath("/tutor", "layout");
    revalidatePath("/student", "layout");
    revalidatePath("/parent", "layout");
  }
  return result;
}
