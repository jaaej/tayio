"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, classMoveRequests, notifications, profiles, subjects } from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { ensureRecurringLessons } from "@/lib/recurring-lessons";
import { ADMIN_TIERS } from "@/lib/roles";
import { classDisplayName } from "@/lib/class-display";
import { classTimeRangeError } from "@/lib/recurring-lesson-rules";
import {
  classChangeTitle,
  planClassScheduleChange,
  slotChangeSummary,
  weeklySlotLabel,
  type ClassSlot,
} from "@/lib/class-schedule-change";
import {
  applyScheduleChangePlan,
  classDeletionImpact,
  classFamilies,
  loadSlotLessons,
  type ClassDeletionImpact,
} from "./class-lessons";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const classSchema = z.object({
  name: z.string().trim().min(1).max(200),
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

/** Blank and missing are the same for a room or link. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function slotOf(data: z.infer<typeof classSchema>): ClassSlot {
  return {
    tutorId: data.tutorId,
    isRecurring: data.isRecurring,
    weekday: data.weekday ?? null,
    startTime: data.startTime || null,
    endTime: data.endTime || null,
    location: clean(data.location),
    onlineLink: clean(data.onlineLink),
  };
}

function tutorName(row: { firstName: string; lastName: string } | undefined) {
  return row ? `${row.firstName} ${row.lastName}`.trim() : "the assigned tutor";
}

function revalidateSchedules(classId?: string) {
  revalidatePath("/admin/classes");
  if (classId) revalidatePath(`/admin/classes/${classId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath("/tutor", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/parent", "layout");
}

export async function createClass(input: z.infer<typeof classSchema>) {
  const user = await requireAdmin();
  const data = classSchema.parse(input);
  const timeError = classTimeRangeError(data.startTime, data.endTime);
  if (timeError) return { ok: false as const, error: timeError };
  const slot = slotOf(data);
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
        location: slot.location,
        onlineLink: slot.onlineLink,
        isRecurring: data.isRecurring,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })
      .returning({ id: classes.id });

    const subjectName = context?.subjectName ?? "Class";
    const displayName = classDisplayName(subjectName, data.name);
    const details = [displayName, weeklySlotLabel(slot), slot.location]
      .filter(Boolean)
      .join(" · ");
    const assignedTo = context
      ? tutorName({ firstName: context.tutorFirstName, lastName: context.tutorLastName })
      : "the assigned tutor";

    await tx.insert(notifications).values([
      {
        userId: data.tutorId,
        channel: "in_app" as const,
        title: "New class assigned",
        body: details,
        href: "/tutor/timetable",
        dedupeKey: `class-created:${r.id}:tutor`,
      },
      ...adminRows.map((admin) => ({
        userId: admin.id,
        channel: "in_app" as const,
        title: "Class created",
        body: `${details} · Assigned to ${assignedTo}`,
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
  revalidateSchedules();
  return { ok: true as const, id: row.id };
}

const updateClassSchema = classSchema.extend({ id: z.string().uuid() });

/**
 * Save a class and carry the change to its upcoming lessons (day, time,
 * tutor, room, link; see planClassScheduleChange), then tell the tutor and,
 * when anyone is enrolled, the students and their parents.
 */
export async function updateClass(input: z.infer<typeof updateClassSchema>) {
  const user = await requireAdmin();
  const data = updateClassSchema.parse(input);
  const timeError = classTimeRangeError(data.startTime, data.endTime);
  if (timeError) return { ok: false as const, error: timeError };
  const after = slotOf(data);
  const now = new Date();

  const saved = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    // The same lock the lesson sweep takes, so the two never interleave.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.id}))`);
    const [current] = await tx
      .select()
      .from(classes)
      .where(eq(classes.id, data.id))
      .for("update");
    if (!current) return false;
    const before: ClassSlot = {
      tutorId: current.tutorId,
      isRecurring: current.isRecurring,
      weekday: current.weekday,
      startTime: current.startTime,
      endTime: current.endTime,
      location: current.location,
      onlineLink: current.onlineLink,
    };

    await tx
      .update(classes)
      .set({
        name: data.name,
        subjectId: data.subjectId,
        tutorId: data.tutorId,
        classType: data.classType,
        capacity: data.capacity,
        location: after.location,
        onlineLink: after.onlineLink,
        isRecurring: data.isRecurring,
        weekday: after.weekday,
        startTime: after.startTime,
        endTime: after.endTime,
      })
      .where(eq(classes.id, data.id));

    const slotLessons = await loadSlotLessons(tx, data.id, now);
    await applyScheduleChangePlan(
      tx,
      planClassScheduleChange({ before, after, lessons: slotLessons, now }),
    );

    const change = slotChangeSummary(before, after);
    if (!change.when && !change.room && !change.tutor) return true;

    const [[subject], tutors, families] = await Promise.all([
      tx
        .select({ name: subjects.name })
        .from(subjects)
        .where(eq(subjects.id, data.subjectId)),
      tx
        .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
        .from(profiles)
        .where(inArray(profiles.id, [before.tutorId, after.tutorId])),
      classFamilies(tx, data.id),
    ]);
    const displayName = classDisplayName(subject?.name ?? "Class", data.name);
    const newTutor = tutorName(tutors.find((t) => t.id === after.tutorId));
    const details = [displayName, weeklySlotLabel(after), after.location];
    const title = classChangeTitle(change);
    const familyBody = [...details, `with ${newTutor}`].filter(Boolean).join(" · ");

    await tx.insert(notifications).values([
      {
        userId: after.tutorId,
        channel: "in_app" as const,
        title: change.tutor ? "New class assigned" : title,
        body: details.filter(Boolean).join(" · "),
        href: `/tutor/classes/${data.id}`,
      },
      ...(change.tutor
        ? [
            {
              userId: before.tutorId,
              channel: "in_app" as const,
              title: "Class reassigned",
              body: `${displayName} · now taught by ${newTutor}`,
              href: "/tutor/timetable",
            },
          ]
        : []),
      ...families.studentIds.map((studentId) => ({
        userId: studentId,
        channel: "in_app" as const,
        title,
        body: familyBody,
        href: "/student/timetable",
      })),
      ...[...families.parentChild].map(([parentId, studentId]) => ({
        userId: parentId,
        channel: "in_app" as const,
        title,
        body: familyBody,
        href: `/parent/classes/${data.id}?child=${studentId}`,
      })),
    ]);
    return true;
  });
  if (!saved) return { ok: false as const, error: "This class no longer exists." };

  if (data.isRecurring) {
    try {
      await ensureRecurringLessons({ classIds: [data.id] });
    } catch (error) {
      console.error("[classes] recurring lesson extension failed:", error);
    }
  }
  revalidateSchedules(data.id);
  return { ok: true as const };
}

/** What deleting the class would remove, for the confirmation dialog. */
export async function getClassDeletionImpact(
  id: string,
): Promise<{ ok: true; impact: ClassDeletionImpact }> {
  await requireAdmin();
  z.string().uuid().parse(id);
  const impact = await db.transaction((tx) => classDeletionImpact(tx, id, new Date()));
  return { ok: true, impact };
}

const deleteClassSchema = z.object({
  id: z.string().uuid(),
  /** The class name, typed by the admin; required once the class has history. */
  confirmName: z.string().max(200).optional(),
});

/**
 * Delete a class with everything attached to it. A class that has already
 * run needs its name typed to confirm, checked here as well as in the dialog.
 */
export async function deleteClass(input: z.infer<typeof deleteClassSchema>) {
  const user = await requireAdmin();
  const { id, confirmName } = deleteClassSchema.parse(input);
  const now = new Date();

  const result = await withActor({ id: user.id, role: "admin" }, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const [current] = await tx
      .select({
        name: classes.name,
        tutorId: classes.tutorId,
        subjectName: subjects.name,
        isRecurring: classes.isRecurring,
        weekday: classes.weekday,
        startTime: classes.startTime,
        endTime: classes.endTime,
        location: classes.location,
        onlineLink: classes.onlineLink,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(eq(classes.id, id))
      .for("update", { of: classes });
    if (!current) return { ok: false as const, error: "This class no longer exists." };

    const impact = await classDeletionImpact(tx, id, now);
    if (impact.hasHistory && confirmName?.trim() !== current.name.trim()) {
      return {
        ok: false as const,
        error: "Type the class name exactly to delete a class that has already run.",
      };
    }

    const families =
      impact.upcomingLessons > 0 ? await classFamilies(tx, id) : null;

    // Move requests point at the class without a cascade; they mean nothing
    // once it is gone.
    await tx
      .delete(classMoveRequests)
      .where(or(eq(classMoveRequests.fromClassId, id), eq(classMoveRequests.toClassId, id)));
    await tx.delete(classes).where(eq(classes.id, id));

    // Only lessons still to come affect anyone's week.
    if (families) {
      const body = [
        classDisplayName(current.subjectName, current.name),
        weeklySlotLabel(current),
      ].join(" · ");
      await tx.insert(notifications).values([
        {
          userId: current.tutorId,
          channel: "in_app" as const,
          title: "Class removed",
          body,
          href: "/tutor/timetable",
        },
        ...families.studentIds.map((studentId) => ({
          userId: studentId,
          channel: "in_app" as const,
          title: "Class removed",
          body,
          href: "/student/timetable",
        })),
        ...[...families.parentChild.keys()].map((parentId) => ({
          userId: parentId,
          channel: "in_app" as const,
          title: "Class removed",
          body,
          href: "/parent",
        })),
      ]);
    }
    return { ok: true as const };
  });

  if (result.ok) revalidateSchedules();
  return result;
}
