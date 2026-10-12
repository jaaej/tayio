"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { announcements, classes, notifications, profiles, subjects } from "@/db/schema";
import { requireTutor } from "@/app/tutor/_data";
import { classDisplayName } from "@/lib/class-display";
import { withActor } from "@/lib/with-actor";

const resubmitSchema = z.object({
  announcementId: z.string().uuid(),
  classId: z.string().uuid(),
  title: z.string().trim().min(1, "Add a title").max(200),
  body: z.string().trim().min(1, "Write a message").max(10000),
  includeLinkedParents: z.boolean(),
  isUrgent: z.boolean(),
});

/**
 * Edit an announcement an admin sent back and put it in the review queue
 * again. Only the author, for a class they still teach, and only while it is
 * in "changes requested"; admins get a fresh approval notification.
 */
export async function resubmitClassAnnouncement(formData: FormData) {
  const tutor = await requireTutor();
  const parsed = resubmitSchema.safeParse({
    announcementId: formData.get("announcementId"),
    classId: formData.get("classId"),
    title: formData.get("title"),
    body: formData.get("body"),
    includeLinkedParents: formData.get("includeLinkedParents") === "on",
    isUrgent: formData.get("isUrgent") === "on",
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Check the announcement and try again.",
    };
  }
  const data = parsed.data;

  const [cls] = await db
    .select({
      name: classes.name,
      subjectName: subjects.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(and(eq(classes.id, data.classId), eq(classes.tutorId, tutor.id)))
    .limit(1);
  if (!cls) return { ok: false as const, error: "Class not found" };

  const admins = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        inArray(profiles.role, ["admin", "admin_restricted", "admin_unrestricted"]),
        eq(profiles.isActive, true),
      ),
    );

  const updated = await withActor({ id: tutor.id, role: "tutor" }, async (tx) => {
    const now = new Date();
    const [row] = await tx
      .update(announcements)
      .set({
        title: data.title,
        body: data.body,
        includeLinkedParents: data.includeLinkedParents,
        isUrgent: data.isUrgent,
        status: "pending",
        rejectedReason: null,
        approvedById: null,
        approvedAt: null,
        publishedAt: now,
      })
      .where(
        and(
          eq(announcements.id, data.announcementId),
          eq(announcements.authorId, tutor.id),
          eq(announcements.audienceClassId, data.classId),
          eq(announcements.status, "rejected"),
        ),
      )
      .returning({ id: announcements.id });
    if (!row) return false;
    if (admins.length) {
      const classLabel = classDisplayName(cls.subjectName, cls.name);
      await tx.insert(notifications).values(
        admins.map((admin) => ({
          userId: admin.id,
          channel: "in_app" as const,
          title: "Tutor announcement approval required",
          body: `${cls.tutorFirst} ${cls.tutorLast} resubmitted “${data.title}” for ${classLabel}${data.includeLinkedParents ? " and linked parents" : ""}${data.isUrgent ? " as urgent" : ""}.`,
          href: `/admin/announcements#announcement-${row.id}`,
          // One per review round: the first submission used the bare key.
          dedupeKey: `announcement-approval:${row.id}:${now.getTime()}`,
        })),
      );
    }
    return true;
  });

  if (!updated) {
    return {
      ok: false as const,
      error: "This announcement is no longer waiting for changes.",
    };
  }
  revalidatePath(`/tutor/classes/${data.classId}`, "layout");
  revalidatePath("/admin/announcements");
  revalidatePath("/admin/notifications");
  return { ok: true as const };
}
