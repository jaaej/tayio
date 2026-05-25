"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications, profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getRescheduleLessonForParent } from "./_data";

function buildRedirect(childId: string, monthIso: string, flag: string) {
  const params = new URLSearchParams();
  if (childId) params.set("child", childId);
  if (monthIso) params.set("month", monthIso);
  params.set(flag, "1");
  return `/parent/bookings?${params.toString()}`;
}

export async function submitRescheduleRequest(formData: FormData) {
  const user = await requireRole("parent");
  const lessonId = String(formData.get("lessonId") ?? "");
  const childId = String(formData.get("childId") ?? "");
  const monthIso = String(formData.get("month") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const preferred = String(formData.get("preferredAlternative") ?? "").trim();

  if (!lessonId || reason.length < 5) {
    redirect(buildRedirect(childId, monthIso, "error"));
  }

  const lesson = await getRescheduleLessonForParent(user.id, lessonId);
  if (!lesson) {
    redirect(buildRedirect(childId, monthIso, "error"));
  }

  // Parent name for the notification context
  const [parentRow] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const parentName = parentRow
    ? `${parentRow.firstName} ${parentRow.lastName}`.trim()
    : "A parent";

  const admins = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.role, "admin"));

  if (admins.length > 0) {
    const body =
      `${lesson.childFirstName}'s ${lesson.subjectName} lesson on ` +
      `${lesson.date} at ${lesson.startTime.slice(0, 5)}. ` +
      `Reason: ${reason}` +
      (preferred ? `. Preferred alternative: ${preferred}` : "");
    await db.insert(notifications).values(
      admins.map((a) => ({
        userId: a.id,
        channel: "in_app" as const,
        title: `Reschedule request from ${parentName}`,
        body,
        href: "/admin",
      })),
    );
  }

  revalidatePath("/parent/bookings");
  redirect(buildRedirect(childId, monthIso, "submitted"));
}
