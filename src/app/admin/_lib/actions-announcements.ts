"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  announcementEmailDeliveries,
  announcementRecipients,
  announcements,
  notifications,
} from "@/db/schema";
import {
  ANNOUNCEMENT_ROLES,
  announcementHrefForRole,
  type AnnouncementTargetRules,
  uniqueValues,
} from "@/lib/announcement-rules";
import { deliverPendingAnnouncementEmails } from "@/lib/announcement-email";
import { resolveAnnouncementRecipients } from "@/lib/announcement-targeting";
import { withActor } from "@/lib/with-actor";
import { requireAdmin } from "./guard";

const roleEnum = z.enum(ANNOUNCEMENT_ROLES);
const uuidArray = z.array(z.string().uuid()).max(100).default([]);

const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  roles: z.array(roleEnum).min(1).max(4),
  subjectIds: uuidArray,
  yearLevels: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  classIds: uuidArray,
  tutorIds: uuidArray,
  includeLinkedParents: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
});

export type CreateAnnouncementInput = z.input<typeof createAnnouncementSchema>;

export async function createAnnouncement(input: CreateAnnouncementInput) {
  const user = await requireAdmin();
  const data = createAnnouncementSchema.parse(input);
  const rules = normaliseRules(data);
  const recipients = await resolveAnnouncementRecipients(rules);
  if (recipients.length === 0) {
    return {
      ok: false as const,
      error: "No active users match that audience. Change the filters and try again.",
    };
  }

  const row = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const [created] = await tx
      .insert(announcements)
      .values({
        authorId: user.id,
        title: data.title,
        body: data.body,
        status: "published",
        isUrgent: data.isUrgent,
        targetRoles: rules.roles,
        targetSubjectIds: rules.subjectIds,
        targetYearLevels: rules.yearLevels,
        targetClassIds: rules.classIds,
        targetTutorIds: rules.tutorIds,
        includeLinkedParents: rules.includeLinkedParents,
        approvedById: user.id,
        approvedAt: new Date(),
      })
      .returning({ id: announcements.id });

    await tx.insert(announcementRecipients).values(
      recipients.map((recipient) => ({
        announcementId: created.id,
        userId: recipient.id,
      })),
    );
    await tx.insert(notifications).values(
      recipients.map((recipient) => ({
        userId: recipient.id,
        channel: "in_app" as const,
        title: data.isUrgent
          ? `Urgent announcement: ${data.title}`
          : `New announcement: ${data.title}`,
        body: data.body,
        href: announcementHrefForRole(recipient.role),
        dedupeKey: `announcement:${created.id}`,
      })),
    );
    if (data.isUrgent) {
      await tx.insert(announcementEmailDeliveries).values(
        recipients.map((recipient) => ({
          announcementId: created.id,
          userId: recipient.id,
        })),
      );
    }
    return created;
  });

  const email = data.isUrgent
    ? await deliverPendingAnnouncementEmails({ announcementId: row.id })
    : null;
  revalidateAnnouncementPaths();
  return {
    ok: true as const,
    id: row.id,
    recipientCount: recipients.length,
    email,
  };
}

export async function approveAnnouncement(id: string) {
  const user = await requireAdmin();
  const announcementId = z.string().uuid().parse(id);
  const [pending] = await db
    .select({
      id: announcements.id,
      authorId: announcements.authorId,
      title: announcements.title,
      body: announcements.body,
      isUrgent: announcements.isUrgent,
      status: announcements.status,
      targetRoles: announcements.targetRoles,
      targetSubjectIds: announcements.targetSubjectIds,
      targetYearLevels: announcements.targetYearLevels,
      targetClassIds: announcements.targetClassIds,
      targetTutorIds: announcements.targetTutorIds,
      includeLinkedParents: announcements.includeLinkedParents,
    })
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1);

  if (!pending || pending.status !== "pending") {
    return { ok: false as const, error: "This announcement is no longer pending." };
  }

  const rules: AnnouncementTargetRules = {
    roles: pending.targetRoles.filter(isAnnouncementRole),
    subjectIds: pending.targetSubjectIds,
    yearLevels: pending.targetYearLevels,
    classIds: pending.targetClassIds,
    tutorIds: pending.targetTutorIds,
    includeLinkedParents: pending.includeLinkedParents,
  };
  const recipients = await resolveAnnouncementRecipients(rules);
  if (recipients.length === 0) {
    return {
      ok: false as const,
      error: "No active users currently match this request. Reject it or update the class roster.",
    };
  }

  const published = await withActor(
    { id: user.id, role: "admin" },
    async (tx) => {
      const [updated] = await tx
        .update(announcements)
        .set({
          status: "published",
          approvedById: user.id,
          approvedAt: new Date(),
          publishedAt: new Date(),
          rejectedReason: null,
        })
        .where(
          and(
            eq(announcements.id, announcementId),
            eq(announcements.status, "pending"),
          ),
        )
        .returning({ id: announcements.id });
      if (!updated) return false;

      await tx.insert(announcementRecipients).values(
        recipients.map((recipient) => ({
          announcementId,
          userId: recipient.id,
        })),
      );
      await tx.insert(notifications).values([
        ...recipients.map((recipient) => ({
          userId: recipient.id,
          channel: "in_app" as const,
          title: pending.isUrgent
            ? `Urgent announcement: ${pending.title}`
            : `New announcement: ${pending.title}`,
          body: pending.body,
          href: announcementHrefForRole(recipient.role),
          dedupeKey: `announcement:${announcementId}`,
        })),
        {
          userId: pending.authorId,
          channel: "in_app" as const,
          title: "Announcement approved",
          body: `“${pending.title}” is now visible to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}.`,
          href: `/tutor/classes/${pending.targetClassIds[0] ?? ""}/curriculum`,
          dedupeKey: `announcement-approved:${announcementId}`,
        },
      ]);
      if (pending.isUrgent) {
        await tx.insert(announcementEmailDeliveries).values(
          recipients.map((recipient) => ({
            announcementId,
            userId: recipient.id,
          })),
        );
      }
      return true;
    },
  );

  if (!published) {
    return { ok: false as const, error: "Another admin already reviewed this announcement." };
  }
  const email = pending.isUrgent
    ? await deliverPendingAnnouncementEmails({ announcementId })
    : null;
  revalidateAnnouncementPaths(pending.targetClassIds[0]);
  return { ok: true as const, recipientCount: recipients.length, email };
}

export async function rejectAnnouncement(input: {
  id: string;
  reason: string;
}) {
  const user = await requireAdmin();
  const data = z
    .object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(1000) })
    .parse(input);

  const result = await withActor(
    { id: user.id, role: "admin" },
    async (tx) => {
      const [row] = await tx
        .update(announcements)
        .set({
          status: "rejected",
          rejectedReason: data.reason,
          approvedById: user.id,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(announcements.id, data.id),
            eq(announcements.status, "pending"),
          ),
        )
        .returning({
          authorId: announcements.authorId,
          title: announcements.title,
          targetClassIds: announcements.targetClassIds,
        });
      if (!row) return null;
      await tx.insert(notifications).values({
        userId: row.authorId,
        channel: "in_app",
        title: "Announcement changes required",
        body: `“${row.title}” was not approved. Admin note: ${data.reason}`,
        href: `/tutor/classes/${row.targetClassIds[0] ?? ""}/curriculum`,
        dedupeKey: `announcement-rejected:${data.id}`,
      });
      return row;
    },
  );

  if (!result) {
    return { ok: false as const, error: "This announcement is no longer pending." };
  }
  revalidateAnnouncementPaths(result.targetClassIds[0]);
  return { ok: true as const };
}

export async function deleteAnnouncement(id: string) {
  const user = await requireAdmin();
  const announcementId = z.string().uuid().parse(id);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx.delete(announcements).where(eq(announcements.id, announcementId)),
  );
  revalidateAnnouncementPaths();
  return { ok: true as const };
}

function normaliseRules(
  data: z.output<typeof createAnnouncementSchema>,
): AnnouncementTargetRules {
  return {
    roles: uniqueValues(data.roles).filter(isAnnouncementRole),
    subjectIds: uniqueValues(data.subjectIds),
    yearLevels: uniqueValues(data.yearLevels),
    classIds: uniqueValues(data.classIds),
    tutorIds: uniqueValues(data.tutorIds),
    includeLinkedParents: data.includeLinkedParents,
  };
}

function isAnnouncementRole(
  value: string,
): value is (typeof ANNOUNCEMENT_ROLES)[number] {
  return ANNOUNCEMENT_ROLES.includes(
    value as (typeof ANNOUNCEMENT_ROLES)[number],
  );
}

function revalidateAnnouncementPaths(classId?: string) {
  revalidatePath("/admin/announcements");
  revalidatePath("/admin");
  revalidatePath("/student");
  revalidatePath("/parent");
  if (classId) revalidatePath(`/tutor/classes/${classId}/curriculum`);
}
