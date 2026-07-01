"use server";

import { revalidatePath } from "next/cache";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { subjectTopics } from "@/db/schema";
import { requireRole } from "@/lib/auth";

const DUP = (msg: string) =>
  msg.includes("subject_topics_subject_name_idx") || msg.includes("duplicate");

const createSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().min(1).max(200),
});

export async function createSubjectTopic(formData: FormData) {
  await requireRole("admin");
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  try {
    const last = await db
      .select({ position: subjectTopics.position })
      .from(subjectTopics)
      .where(eq(subjectTopics.subjectId, parsed.data.subjectId))
      .orderBy(desc(subjectTopics.position))
      .limit(1);
    const nextPos = (last[0]?.position ?? -1) + 1;
    const [row] = await db
      .insert(subjectTopics)
      .values({ ...parsed.data, position: nextPos })
      .returning();
    revalidatePath(`/admin/subjects/${parsed.data.subjectId}/curriculum`);
    return { ok: true as const, id: row.id };
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false as const, error: DUP(msg) ? "A topic with that name already exists." : msg };
  }
}

export async function renameSubjectTopic(id: string, subjectId: string, formData: FormData) {
  await requireRole("admin");
  const parsed = z
    .object({ name: z.string().min(1).max(200) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  try {
    await db
      .update(subjectTopics)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(subjectTopics.id, id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false as const, error: DUP(msg) ? "A topic with that name already exists." : msg };
  }
}

export async function reorderSubjectTopic(
  id: string,
  subjectId: string,
  direction: "up" | "down",
) {
  await requireRole("admin");
  try {
    const topics = await db
      .select()
      .from(subjectTopics)
      .where(eq(subjectTopics.subjectId, subjectId))
      .orderBy(asc(subjectTopics.position));
    const idx = topics.findIndex((t) => t.id === id);
    if (idx === -1) return { ok: false as const, error: "Topic not found." };
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= topics.length) return { ok: true as const }; // no-op at ends
    const a = topics[idx];
    const b = topics[swap];
    await db.update(subjectTopics).set({ position: b.position }).where(eq(subjectTopics.id, a.id));
    await db.update(subjectTopics).set({ position: a.position }).where(eq(subjectTopics.id, b.id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function deleteSubjectTopic(id: string, subjectId: string) {
  await requireRole("admin");
  try {
    // subject_weeks.topic_id is ON DELETE SET NULL, so weeks become unassigned.
    await db.delete(subjectTopics).where(eq(subjectTopics.id, id));
    revalidatePath(`/admin/subjects/${subjectId}/curriculum`);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}
