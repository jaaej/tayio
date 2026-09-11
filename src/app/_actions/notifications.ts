"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

function revalidateNotificationSurfaces() {
  revalidatePath("/admin", "layout");
  revalidatePath("/tutor", "layout");
  revalidatePath("/parent", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/admin/notifications");
  revalidatePath("/tutor/notifications");
  revalidatePath("/parent/notifications");
  revalidatePath("/student/notifications");
}

export async function markNotificationRead(id: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, user.id)),
    );
  revalidateNotificationSurfaces();
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, user.id),
        isNull(notifications.readAt),
      ),
    );
  revalidateNotificationSurfaces();
}
