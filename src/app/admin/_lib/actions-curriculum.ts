"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { subjectWeeks } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { uploadCurriculumFile } from "@/lib/curriculum-storage";

const weekInputSchema = z.object({
  subjectId: z.string().uuid(),
  termId: z.string().uuid(),
  weekNumber: z.coerce.number().int().min(1).max(20),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  bookletUrl: z.string().optional(),
});

export async function createSubjectWeek(formData: FormData) {
  await requireRole("admin");
  const parsed = weekInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    const [row] = await db.insert(subjectWeeks).values(parsed.data).returning();
    revalidatePath(`/admin/subjects/${parsed.data.subjectId}/curriculum`);
    return { ok: true as const, id: row.id };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function updateSubjectWeek(id: string, formData: FormData) {
  await requireRole("admin");
  const parsed = weekInputSchema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  try {
    await db
      .update(subjectWeeks)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(subjectWeeks.id, id));
    if (parsed.data.subjectId) {
      revalidatePath(`/admin/subjects/${parsed.data.subjectId}/curriculum`);
    }
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteSubjectWeek(id: string, subjectId: string) {
  await requireRole("admin");
  try {
    await db.delete(subjectWeeks).where(eq(subjectWeeks.id, id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function uploadAdminVideo(
  subjectWeekId: string,
  formData: FormData,
) {
  await requireRole("admin");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const result = await uploadCurriculumFile("videos", subjectWeekId, file);
  if (!result.ok) return result;

  await db
    .update(subjectWeeks)
    .set({ videoUrl: result.path, updatedAt: new Date() })
    .where(eq(subjectWeeks.id, subjectWeekId));
  return { ok: true as const, path: result.path };
}

export async function uploadAdminBooklet(
  subjectWeekId: string,
  formData: FormData,
) {
  await requireRole("admin");
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const result = await uploadCurriculumFile("booklets", subjectWeekId, file);
  if (!result.ok) return result;

  await db
    .update(subjectWeeks)
    .set({ bookletUrl: result.path, updatedAt: new Date() })
    .where(eq(subjectWeeks.id, subjectWeekId));
  return { ok: true as const, path: result.path };
}
