import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";

export async function getNotifications(userId: string, limit = 100) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
  return rows.length;
}
