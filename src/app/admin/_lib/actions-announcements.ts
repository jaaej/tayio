"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { announcements } from "@/db/schema";
import { requireAdmin } from "./guard";

const roleEnum = z.enum(["student", "parent", "tutor", "admin"]);

const createAnnouncementSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.string().min(1),
    audienceRole: roleEnum.optional().nullable(),
    audienceClassId: z.string().uuid().optional().nullable(),
  })
  .refine(
    (v) => !(v.audienceRole && v.audienceClassId),
    "Pick either a role audience or a class audience, not both",
  );

export async function createAnnouncement(
  input: z.infer<typeof createAnnouncementSchema>,
) {
  const user = await requireAdmin();
  const data = createAnnouncementSchema.parse(input);
  const [row] = await db
    .insert(announcements)
    .values({
      authorId: user.id,
      title: data.title,
      body: data.body,
      audienceRole: data.audienceRole || null,
      audienceClassId: data.audienceClassId || null,
    })
    .returning({ id: announcements.id });
  revalidatePath("/admin/announcements");
  return { ok: true as const, id: row.id };
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin();
  z.string().uuid().parse(id);
  await db.delete(announcements).where(eq(announcements.id, id));
  revalidatePath("/admin/announcements");
  return { ok: true as const };
}
