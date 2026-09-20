"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, notifications, profiles, subjects } from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { ensureRecurringLessons } from "@/lib/recurring-lessons";
import { ADMIN_TIERS } from "@/lib/roles";
import { classDisplayName } from "@/lib/class-display";
import { formatTime } from "@/lib/format";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const subjectSchema = z.object({
  name: z.string().min(1).max(200),
  yearLevel: z.string().max(40).optional(),
  description: z.string().max(5000).optional(),
});

export async function createSubject(input: z.infer<typeof subjectSchema>) {
  await requireAdmin();
  const data = subjectSchema.parse(input);
  const [row] = await db
    .insert(subjects)
    .values({
      name: data.name,
      yearLevel: data.yearLevel ?? null,
      description: data.description ?? null,
    })
    .returning({ id: subjects.id });
  revalidatePath("/admin/classes");
  return { ok: true as const, id: row.id };
}

const classSchema = z.object({
  name: z.string().min(1).max(200),
  subjectId: z.string().uuid(),
  tutorId: z.string().uuid(),
  classType: z.enum(["group", "one_on_one"]).default("group"),
  capacity: z.coerce.number().int().min(1).max(200),
  location: z.string().max(200).optional().nullable(),
  onlineLink: z.string().url().max(2000).optional().or(z.literal("")).nullable(),
  isRecurring: z.coerce.boolean(),
  weekday: z.coerce.number().int().min(0).max(6).optional().nullable(),
  startTime: z.string().regex(timeRegex).optional().nullable(),
  endTime: z.string().regex(timeRegex).optional().nullable(),
});

export async function createClass(input: z.infer<typeof classSchema>) {
  const user = await requireAdmin();
  const data = classSchema.parse(input);
  const row = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const [[context], adminRows] = await Promise.all([
      tx
        .select({
          subjectName: subjects.name,
          tutorFirstName: profiles.firstName,
          tutorLastName: profiles.lastName,
        })
        .from(subjects)
        .innerJoin(profiles, eq(profiles.id, data.tutorId))
        .where(
          and(
            eq(subjects.id, data.subjectId),
            eq(profiles.id, data.tutorId),
          ),
        )
        .limit(1),
      tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(
          and(
            inArray(profiles.role, ADMIN_TIERS),
            eq(profiles.isActive, true),
          ),
        ),
    ]);

    const [r] = await tx
      .insert(classes)
      .values({
        name: data.name,
        subjectId: data.subjectId,
        tutorId: data.tutorId,
        classType: data.classType,
        capacity: data.capacity,
        location: data.location || null,
        onlineLink: data.onlineLink || null,
        isRecurring: data.isRecurring,
        weekday: data.weekday ?? null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
      })
      .returning({ id: classes.id });

    const subjectName = context?.subjectName ?? "Class";
    const displayName = classDisplayName(subjectName, data.name);
    const schedule =
      data.isRecurring &&
      data.weekday !== null &&
      data.weekday !== undefined &&
      data.startTime &&
      data.endTime
        ? `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][data.weekday]} · ${formatTime(data.startTime)}–${formatTime(data.endTime)}`
        : "No recurring weekly time";
    const tutorName = context
      ? `${context.tutorFirstName} ${context.tutorLastName}`.trim()
      : "the assigned tutor";

    await tx.insert(notifications).values([
      {
        userId: data.tutorId,
        channel: "in_app" as const,
        title: "New class assigned",
        body: `${displayName} · ${schedule}`,
        href: "/tutor/timetable",
        dedupeKey: `class-created:${r.id}:tutor`,
      },
      ...adminRows.map((admin) => ({
        userId: admin.id,
        channel: "in_app" as const,
        title: "Class created",
        body: `${displayName} · ${schedule} · Assigned to ${tutorName}`,
        href: `/admin/classes/${r.id}`,
        dedupeKey: `class-created:${r.id}:admin`,
      })),
    ]);
    return r;
  });
  if (data.isRecurring) {
    try {
      await ensureRecurringLessons({ classIds: [row.id] });
    } catch (error) {
      // The class itself is valid and the daily sweep will safely retry its
      // timetable. Do not encourage an admin to create the same class twice.
      console.error("[classes] initial recurring lesson generation failed:", error);
    }
  }
  revalidatePath("/admin/classes");
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath("/tutor/classes");
  revalidatePath("/tutor/timetable");
  revalidatePath("/tutor/notifications");
  return { ok: true as const, id: row.id };
}

const updateClassSchema = classSchema.extend({ id: z.string().uuid() });

export async function updateClass(input: z.infer<typeof updateClassSchema>) {
  const user = await requireAdmin();
  const data = updateClassSchema.parse(input);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx
      .update(classes)
      .set({
        name: data.name,
        subjectId: data.subjectId,
        tutorId: data.tutorId,
        classType: data.classType,
        capacity: data.capacity,
        location: data.location || null,
        onlineLink: data.onlineLink || null,
        isRecurring: data.isRecurring,
        weekday: data.weekday ?? null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
      })
      .where(eq(classes.id, data.id)),
  );
  if (data.isRecurring) {
    try {
      await ensureRecurringLessons({ classIds: [data.id] });
    } catch (error) {
      console.error("[classes] recurring lesson extension failed:", error);
    }
  }
  revalidatePath("/admin/classes");
  return { ok: true as const };
}

export async function deleteClass(id: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx.delete(classes).where(eq(classes.id, id)),
  );
  revalidatePath("/admin/classes");
  return { ok: true as const };
}
