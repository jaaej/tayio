"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { tutorAvailability, profiles, classes } from "@/db/schema";
import { requireAdmin } from "./guard";

const schema = z.object({
  tutorId: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  // Accept HH:MM (time inputs); Postgres stores/compares as a time value.
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  // Null / absent = the slot applies to any subject (migration 0040).
  subjectId: z.string().uuid().nullish(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

// Expected failures come back as { ok: false, error } rather than throwing:
// production masks thrown server-action messages, so a thrown "Tutor not
// found" would reach the admin as a generic error.
const INVALID = "Check the day and times, then try again.";

async function isTutor(tutorId: string) {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, tutorId), eq(profiles.role, "tutor")))
    .limit(1);
  return Boolean(row);
}

/**
 * A slot may only be scoped to a subject the tutor actually teaches - the
 * client sends the subject id, so it is re-derived from the tutor's classes
 * here rather than trusted.
 */
async function tutorTeachesSubject(tutorId: string, subjectId: string) {
  const [row] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.tutorId, tutorId), eq(classes.subjectId, subjectId)))
    .limit(1);
  return Boolean(row);
}

/** eq() when the slot is scoped to a subject, IS NULL when it is not. */
function subjectMatch(subjectId: string | null) {
  return subjectId === null
    ? isNull(tutorAvailability.subjectId)
    : eq(tutorAvailability.subjectId, subjectId);
}

/**
 * Admin adds a recurring weekly availability slot for a tutor (the same
 * standing-rule concept the tutor manages themselves), optionally scoped to one
 * of the subjects that tutor teaches. Admin-only. No-op if an identical rule
 * already exists for the same subject scope.
 */
export async function addTutorAvailabilityRule(
  input: z.infer<typeof schema>,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };
  const data = parsed.data;
  if (data.endTime <= data.startTime) {
    return { ok: false, error: "End time must be after the start time." };
  }
  if (!(await isTutor(data.tutorId))) {
    return { ok: false, error: "That tutor no longer exists." };
  }
  const subjectId = data.subjectId ?? null;
  if (subjectId !== null && !(await tutorTeachesSubject(data.tutorId, subjectId))) {
    return { ok: false, error: "This tutor doesn't teach that subject." };
  }

  // Subject is part of the identity of a slot: the same window may exist once
  // per subject, so an untagged slot never blocks a Maths one and vice versa.
  const existing = await db
    .select({ id: tutorAvailability.id })
    .from(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, data.tutorId),
        eq(tutorAvailability.weekday, data.weekday),
        eq(tutorAvailability.startTime, data.startTime),
        eq(tutorAvailability.endTime, data.endTime),
        isNull(tutorAvailability.date),
        subjectMatch(subjectId),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(tutorAvailability).values({
      tutorId: data.tutorId,
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      subjectId,
      isAvailable: true,
    });
  }

  revalidatePath("/admin/tutors/availability");
  return { ok: true };
}

/**
 * Admin removes a recurring weekly availability slot for a tutor (matches on
 * subject scope + weekday + times; per-date overrides are untouched, and an
 * identical window under another subject is left alone). Admin-only.
 */
export async function removeTutorAvailabilityRule(
  input: z.infer<typeof schema>,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: INVALID };
  const data = parsed.data;
  await db
    .delete(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, data.tutorId),
        eq(tutorAvailability.weekday, data.weekday),
        eq(tutorAvailability.startTime, data.startTime),
        eq(tutorAvailability.endTime, data.endTime),
        isNull(tutorAvailability.date),
        subjectMatch(data.subjectId ?? null),
      ),
    );

  revalidatePath("/admin/tutors/availability");
  return { ok: true };
}
