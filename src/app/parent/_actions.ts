"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications, profiles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getRescheduleLessonForParent } from "./_data";
import { formatDateLong, formatTime } from "@/lib/format";

function buildRedirect(childId: string, monthIso: string, flag: string) {
  const params = new URLSearchParams();
  if (childId) params.set("child", childId);
  if (monthIso) params.set("month", monthIso);
  params.set(flag, "1");
  return `/parent/classes?${params.toString()}`;
}

function parseSlot(raw: string): {
  date: string;
  startTime: string;
  endTime: string;
  tutorId: string;
} | null {
  const parts = raw.split("|");
  if (parts.length !== 4) return null;
  const [date, startTime, endTime, tutorId] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return null;
  }
  if (!tutorId) return null;
  return { date, startTime, endTime, tutorId };
}

export async function submitRescheduleRequest(formData: FormData) {
  const user = await requireRole("parent");
  const lessonId = String(formData.get("lessonId") ?? "");
  const childId = String(formData.get("childId") ?? "");
  const monthIso = String(formData.get("month") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!lessonId || reason.length > 2000) {
    redirect(buildRedirect(childId, monthIso, "error"));
  }

  const slot = parseSlot(slotRaw);
  if (!slot) {
    redirect(buildRedirect(childId, monthIso, "error"));
  }

  const lesson = await getRescheduleLessonForParent(user.id, lessonId);
  if (!lesson) {
    redirect(buildRedirect(childId, monthIso, "error"));
  }

  const [parentRow] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  const parentName = parentRow
    ? `${parentRow.firstName} ${parentRow.lastName}`.trim()
    : "A parent";

  const [tutorRow] = await db
    .select({ firstName: profiles.firstName, lastName: profiles.lastName })
    .from(profiles)
    .where(eq(profiles.id, slot.tutorId))
    .limit(1);
  const newTutorName = tutorRow
    ? `${tutorRow.firstName} ${tutorRow.lastName}`.trim()
    : "another tutor";

  const admins = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.role, "admin"));

  if (admins.length > 0) {
    const body =
      `${lesson.childFirstName}'s ${lesson.subjectName} lesson on ` +
      `${formatDateLong(lesson.date)} at ${formatTime(lesson.startTime)} ` +
      `→ requested move to ${formatDateLong(slot.date)} ` +
      `${formatTime(slot.startTime)}–${formatTime(slot.endTime)} ` +
      `with ${newTutorName}.` +
      (reason ? ` Reason: ${reason}` : "");
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

  revalidatePath("/parent/classes");
  redirect(buildRedirect(childId, monthIso, "submitted"));
}
