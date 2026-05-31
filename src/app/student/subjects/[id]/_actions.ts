"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  classWeekOverrides,
  enrollments,
  studentWeekProgress,
  subjectWeeks,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { signCurriculumUrl } from "@/lib/curriculum-storage";

async function assertStudentCanAccessWeek(
  studentId: string,
  subjectWeekId: string,
) {
  const [row] = await db
    .select({ id: subjectWeeks.id })
    .from(subjectWeeks)
    .innerJoin(classes, eq(classes.subjectId, subjectWeeks.subjectId))
    .innerJoin(enrollments, eq(enrollments.classId, classes.id))
    .where(
      and(
        eq(subjectWeeks.id, subjectWeekId),
        eq(enrollments.studentId, studentId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

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
  if (!(await assertStudentCanAccessWeek(user.id, subjectWeekId))) {
    return { ok: false as const, error: "Not enrolled" };
  }
  await upsertProgress(user.id, subjectWeekId, "videoWatchedAt");
  revalidatePath(`/student/subjects`);
  return { ok: true as const };
}

export async function markBookletOpened(
  subjectWeekId: string,
  classId: string,
) {
  const user = await requireRole("student");
  if (!(await assertStudentCanAccessWeek(user.id, subjectWeekId))) {
    return { ok: false as const, error: "Not enrolled" };
  }
  const [override] = await db
    .select({ path: classWeekOverrides.bookletUrl })
    .from(classWeekOverrides)
    .where(
      and(
        eq(classWeekOverrides.subjectWeekId, subjectWeekId),
        eq(classWeekOverrides.classId, classId),
      ),
    )
    .limit(1);
  const [tpl] = await db
    .select({ path: subjectWeeks.bookletUrl })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  const path = override?.path ?? tpl?.path ?? null;
  const url = await signCurriculumUrl(path);
  if (!url) return { ok: false as const, error: "Booklet unavailable" };

  await upsertProgress(user.id, subjectWeekId, "bookletOpenedAt");
  return { ok: true as const, url };
}
