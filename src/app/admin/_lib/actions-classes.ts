"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, subjects } from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";

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
    return r;
  });
  revalidatePath("/admin/classes");
  revalidatePath("/admin/enrolments");
  revalidatePath("/admin");
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
  revalidatePath("/admin/classes");
  revalidatePath("/admin/enrolments");
  return { ok: true as const };
}

export async function deleteClass(id: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);
  await withActor({ id: user.id, role: "admin" }, (tx) =>
    tx.delete(classes).where(eq(classes.id, id)),
  );
  revalidatePath("/admin/classes");
  revalidatePath("/admin/enrolments");
  return { ok: true as const };
}
