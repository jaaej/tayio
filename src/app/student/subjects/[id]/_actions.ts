"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  studentWeekProgress,
  subjectWeeks,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { canStudentAccessCurriculumWeek } from "@/lib/curriculum-access";

async function upsertProgress(
  studentId: string,
  subjectWeekId: string,
  field: "videoWatchedAt" | "bookletOpenedAt",
) {
  await db
    .insert(studentWeekProgress)
    .values({ studentId, subjectWeekId, [field]: new Date() })
    .onConflictDoUpdate({
      target: [
        studentWeekProgress.studentId,
        studentWeekProgress.subjectWeekId,
      ],
      set: { [field]: new Date() },
    });
}

export async function markVideoWatched(subjectWeekId: string) {
  const user = await requireRole("student");
  if (!(await canStudentAccessCurriculumWeek(user.id, subjectWeekId))) {
    return { ok: false as const, error: "This week is not available yet" };
  }
  await upsertProgress(user.id, subjectWeekId, "videoWatchedAt");
  // Refreshes the open subject page so the week's checklist ticks it off.
  revalidatePath("/student/subjects/[id]", "page");
  return { ok: true as const };
}

/** Records that the student opened the week booklet (it opens in the writing viewer). */
export async function markBookletOpened(subjectWeekId: string) {
  const user = await requireRole("student");
  if (!(await canStudentAccessCurriculumWeek(user.id, subjectWeekId))) {
    return { ok: false as const, error: "This week is not available yet" };
  }
  const [tpl] = await db
    .select({ path: subjectWeeks.bookletUrl })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  if (!tpl?.path) return { ok: false as const, error: "Booklet unavailable" };

  await upsertProgress(user.id, subjectWeekId, "bookletOpenedAt");
  revalidatePath("/student/subjects/[id]", "page");
  return { ok: true as const };
}
