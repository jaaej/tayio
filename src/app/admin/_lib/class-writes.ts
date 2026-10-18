import "server-only";

import { z } from "zod";
import { and, eq, gte, inArray, min, sql } from "drizzle-orm";
import type { db } from "@/db/client";
import { classes, lessons, notifications, profiles, subjects } from "@/db/schema";
import { ADMIN_TIERS } from "@/lib/roles";
import { classDisplayName } from "@/lib/class-display";
import { DEFAULT_GROUP_CAPACITY, classCapacity } from "@/lib/class-capacity";
import { classTimeRangeError } from "@/lib/recurring-lesson-rules";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  classChangeTitle,
  classMoveSentence,
  planClassScheduleChange,
  slotChangeSummary,
  slotClassName,
  weeklySlotLabel,
  type ClassSlot,
} from "@/lib/class-schedule-change";
import { applyScheduleChangePlan, classFamilies, loadSlotLessons } from "./class-lessons";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/** Every editable class field; a missing field keeps the saved value. */
export const classPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subjectId: z.string().uuid().optional(),
  tutorId: z.string().uuid().optional(),
  classType: z.enum(["group", "one_on_one"]).optional(),
  capacity: z.coerce.number().int().min(1).max(200).optional(),
  location: z.string().max(200).nullable().optional(),
  isRecurring: z.coerce.boolean().optional(),
  weekday: z.coerce.number().int().min(0).max(6).nullable().optional(),
  startTime: z.string().regex(timeRegex).nullable().optional(),
  endTime: z.string().regex(timeRegex).nullable().optional(),
});
export type ClassPatch = z.infer<typeof classPatchSchema>;
/** An edit to a saved class; a class stays in its subject. */
export type ClassEdit = Omit<ClassPatch, "subjectId">;

/** Blank and missing are the same for a room. */
export function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function tutorName(row: { firstName: string; lastName: string } | undefined) {
  return row ? `${row.firstName} ${row.lastName}`.trim() : "the assigned tutor";
}

/** The weekly slot a class would have after `patch`. */
function slotAfter(
  current: Omit<ClassSlot, "isRecurring"> & { isRecurring: boolean },
  patch: ClassEdit,
): ClassSlot {
  const pick = <K extends keyof ClassSlot>(key: K, value: ClassSlot[K] | undefined) =>
    value === undefined ? current[key] : value;
  return {
    tutorId: pick("tutorId", patch.tutorId),
    isRecurring: pick("isRecurring", patch.isRecurring),
    weekday: pick("weekday", patch.weekday),
    startTime: pick("startTime", patch.startTime === undefined ? undefined : patch.startTime || null),
    endTime: pick("endTime", patch.endTime === undefined ? undefined : patch.endTime || null),
    location: patch.location === undefined ? current.location : clean(patch.location),
  };
}

/** A time-range problem in a patch, as a sentence, or null. */
export function patchTimeError(patch: ClassPatch): string | null {
  return classTimeRangeError(patch.startTime ?? null, patch.endTime ?? null);
}

/**
 * Create a class inside the caller's transaction and tell its tutor and the
 * admins. Without a name it is named from its slot ("Thursday PM").
 */
export async function insertClass(
  tx: DbTx,
  data: ClassPatch & { subjectId: string; tutorId: string },
): Promise<string> {
  const slot: ClassSlot = {
    tutorId: data.tutorId,
    isRecurring: data.isRecurring ?? true,
    weekday: data.weekday ?? null,
    startTime: data.startTime || null,
    endTime: data.endTime || null,
    location: clean(data.location),
  };
  const name = data.name ?? slotClassName(slot) ?? "Class";

  const [[context], adminRows] = await Promise.all([
    tx
      .select({
        subjectName: subjects.name,
        tutorFirstName: profiles.firstName,
        tutorLastName: profiles.lastName,
      })
      .from(subjects)
      .innerJoin(profiles, eq(profiles.id, data.tutorId))
      .where(and(eq(subjects.id, data.subjectId), eq(profiles.id, data.tutorId)))
      .limit(1),
    tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(inArray(profiles.role, ADMIN_TIERS), eq(profiles.isActive, true))),
  ]);

  const [row] = await tx
    .insert(classes)
    .values({
      name,
      subjectId: data.subjectId,
      tutorId: data.tutorId,
      classType: data.classType ?? "group",
      capacity: classCapacity(data.classType ?? "group", data.capacity ?? DEFAULT_GROUP_CAPACITY),
      location: slot.location,
      isRecurring: slot.isRecurring,
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })
    .returning({ id: classes.id });

  const displayName = classDisplayName(context?.subjectName ?? "Class", name);
  const details = [displayName, weeklySlotLabel(slot), slot.location].filter(Boolean).join(" · ");
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
      dedupeKey: `class-created:${row.id}:tutor`,
    },
    ...adminRows.map((admin) => ({
      userId: admin.id,
      channel: "in_app" as const,
      title: "Class created",
      body: `${details} · Assigned to ${assignedTo}`,
      href: `/admin/classes/${row.id}`,
      dedupeKey: `class-created:${row.id}:admin`,
    })),
  ]);
  return row.id;
}

/**
 * Save an edit to a class inside the caller's transaction and carry it to the
 * upcoming lessons (planClassScheduleChange). A new day, time or room tells
 * the tutor, the enrolled students and their parents; a new tutor tells both
 * tutors. Returns false when the class no longer exists.
 */
export async function applyClassEdit(
  tx: DbTx,
  id: string,
  patch: ClassEdit,
  now: Date,
): Promise<boolean> {
  // The same lock the lesson sweep takes, so the two never interleave.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
  const [current] = await tx.select().from(classes).where(eq(classes.id, id)).for("update");
  if (!current) return false;

  const before: ClassSlot = {
    tutorId: current.tutorId,
    isRecurring: current.isRecurring,
    weekday: current.weekday,
    startTime: current.startTime,
    endTime: current.endTime,
    location: current.location,
  };
  const after = slotAfter(before, patch);
  const change = slotChangeSummary(before, after);

  // A "Thursday PM" name follows its slot unless the admin renamed it.
  const name = patch.name ?? current.name;
  const nextName =
    change.when && name === current.name ? (slotClassName(after, name) ?? name) : name;

  await tx
    .update(classes)
    .set({
      name: nextName,
      tutorId: after.tutorId,
      classType: patch.classType ?? current.classType,
      capacity: classCapacity(patch.classType ?? current.classType, patch.capacity ?? current.capacity),
      location: after.location,
      isRecurring: after.isRecurring,
      weekday: after.weekday,
      startTime: after.startTime,
      endTime: after.endTime,
    })
    .where(eq(classes.id, id));

  const slotLessons = await loadSlotLessons(tx, id, now);
  await applyScheduleChangePlan(
    tx,
    planClassScheduleChange({ before, after, lessons: slotLessons, now }),
  );

  if (!change.when && !change.room && !change.tutor) return true;

  const [[subject], tutors, families, [first]] = await Promise.all([
    tx
      .select({ name: subjects.name })
      .from(subjects)
      .where(eq(subjects.id, current.subjectId)),
    tx
      .select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles)
      .where(inArray(profiles.id, [before.tutorId, after.tutorId])),
    classFamilies(tx, id),
    tx
      .select({ date: min(lessons.date) })
      .from(lessons)
      .where(
        and(
          eq(lessons.classId, id),
          eq(lessons.status, "upcoming"),
          gte(lessons.date, melbourneDate(now)),
        ),
      ),
  ]);
  const displayName = classDisplayName(subject?.name ?? "Class", nextName);
  const newTutor = tutorName(tutors.find((t) => t.id === after.tutorId));
  const moved = change.when || change.room;
  const familyChange = { ...change, tutor: false };
  const title = classChangeTitle(familyChange);
  const sentence = classMoveSentence(displayName, after, familyChange, first?.date ?? null);

  const rows: (typeof notifications.$inferInsert)[] = [];
  if (change.tutor) {
    rows.push(
      {
        userId: after.tutorId,
        channel: "in_app",
        title: "New class assigned",
        body: [displayName, weeklySlotLabel(after), after.location].filter(Boolean).join(" · "),
        href: `/tutor/classes/${id}`,
      },
      {
        userId: before.tutorId,
        channel: "in_app",
        title: "Class reassigned",
        body: `${displayName} · now taught by ${newTutor}`,
        href: "/tutor/timetable",
      },
    );
  } else if (moved) {
    rows.push({
      userId: after.tutorId,
      channel: "in_app",
      title,
      body: sentence,
      href: `/tutor/classes/${id}`,
    });
  }
  if (moved) {
    for (const studentId of families.studentIds) {
      rows.push({ userId: studentId, channel: "in_app", title, body: sentence, href: "/student/timetable" });
    }
    for (const [parentId, studentId] of families.parentChild) {
      rows.push({
        userId: parentId,
        channel: "in_app",
        title,
        body: sentence,
        href: `/parent/classes/${id}?child=${studentId}`,
      });
    }
  }
  if (rows.length > 0) await tx.insert(notifications).values(rows);
  return true;
}
