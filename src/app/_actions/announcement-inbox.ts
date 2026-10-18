"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { announcementRecipients, announcements } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One published announcement the signed-in person received, for the inbox
 * when a link names an announcement whose notification is not in the loaded
 * list (older than the newest 100). Recipients only.
 */
export async function loadAnnouncementForInbox(announcementId: string) {
  const user = await getCurrentUser();
  if (!user || !UUID.test(announcementId)) return { ok: false as const };
  const [row] = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      isUrgent: announcements.isUrgent,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .innerJoin(
      announcementRecipients,
      and(
        eq(announcementRecipients.announcementId, announcements.id),
        eq(announcementRecipients.userId, user.id),
      ),
    )
    .where(and(eq(announcements.id, announcementId), eq(announcements.status, "published")))
    .limit(1);
  if (!row) return { ok: false as const };
  return {
    ok: true as const,
    announcement: {
      id: row.id,
      title: row.title,
      body: row.body,
      isUrgent: row.isUrgent,
      publishedAtIso: row.publishedAt.toISOString(),
    },
  };
}
