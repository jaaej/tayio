"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { tutorAvailability, profiles } from "@/db/schema";
import { requireAdmin } from "./guard";

const schema = z.object({
  tutorId: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  // Accept HH:MM (time inputs); Postgres stores/compares as a time value.
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

async function assertTutor(tutorId: string) {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, tutorId), eq(profiles.role, "tutor")))
    .limit(1);
  if (!row) throw new Error("Tutor not found");
}

/**
 * Admin adds a recurring weekly availability slot for a tutor (the same
 * standing-rule concept the tutor manages themselves). Admin-only. No-op if an
 * identical rule already exists.
 */
export async function addTutorAvailabilityRule(input: z.infer<typeof schema>) {
  await requireAdmin();
  const data = schema.parse(input);
  if (data.endTime <= data.startTime) {
    throw new Error("End time must be after the start time.");
  }
  await assertTutor(data.tutorId);

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
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(tutorAvailability).values({
      tutorId: data.tutorId,
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      isAvailable: true,
    });
  }

  revalidatePath("/admin/tutors/availability");
  return { ok: true as const };
}

/**
 * Admin removes a recurring weekly availability slot for a tutor (matches on
 * weekday + times; per-date overrides are untouched). Admin-only.
 */
export async function removeTutorAvailabilityRule(
  input: z.infer<typeof schema>,
) {
  await requireAdmin();
  const data = schema.parse(input);
  await db
    .delete(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, data.tutorId),
        eq(tutorAvailability.weekday, data.weekday),
        eq(tutorAvailability.startTime, data.startTime),
        eq(tutorAvailability.endTime, data.endTime),
        isNull(tutorAvailability.date),
      ),
    );

  revalidatePath("/admin/tutors/availability");
  return { ok: true as const };
}
