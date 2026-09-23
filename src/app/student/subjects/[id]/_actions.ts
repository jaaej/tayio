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
import { signCurriculumUrl } from "@/lib/curriculum-storage";

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
  revalidatePath(`/student/subjects`);
  return { ok: true as const };
}

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
  const path = tpl?.path ?? null;
  const url = await signCurriculumUrl(path);
  if (!url) return { ok: false as const, error: "Booklet unavailable" };

  await upsertProgress(user.id, subjectWeekId, "bookletOpenedAt");
  return { ok: true as const, url };
}
