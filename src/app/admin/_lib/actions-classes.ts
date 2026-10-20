"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { classes, classMoveRequests, notifications, profiles, subjects } from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { ensureRecurringLessons } from "@/lib/recurring-lessons";
import { classDisplayName } from "@/lib/class-display";
import { formatTimeRange } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { weeklySlotLabel } from "@/lib/class-schedule-change";
import {
  classDeletionImpact,
  classFamilies,
  type ClassDeletionImpact,
} from "./class-lessons";
import { classPatchSchema, insertClass, patchTimeError } from "./class-writes";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const classSchema = classPatchSchema.required({
  name: true,
  subjectId: true,
  tutorId: true,
  capacity: true,
  isRecurring: true,
});

function revalidateSchedules() {
  revalidatePath("/admin/classes");
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/notifications");
  revalidatePath("/tutor", "layout");
  revalidatePath("/student", "layout");
  revalidatePath("/parent", "layout");
}

export async function createClass(input: z.input<typeof classSchema>) {
  const user = await requireAdmin();
  const data = classSchema.parse(input);
  const timeError = patchTimeError(data);
  if (timeError) return { ok: false as const, error: timeError };
  const id = await withActor({ id: user.id, role: "admin" }, (tx) => insertClass(tx, data));
  if (data.isRecurring) {
    try {
      await ensureRecurringLessons({ classIds: [id] });
    } catch (error) {
      // The class itself is valid and the daily sweep will safely retry its
      // timetable. Do not encourage an admin to create the same class twice.
      console.error("[classes] initial recurring lesson generation failed:", error);
    }
  }
  revalidateSchedules();
  return { ok: true as const, id };
}

/**
 * What deleting the class would do, for its confirmation: the counts, and the
 * line naming the class ("Year 9 Maths · Saturday 10:00 – 11:00 am · Tom
 * Tutor") with its subject colour.
 */
export async function getClassDeletionImpact(id: string): Promise<
  | { ok: true; impact: ClassDeletionImpact; subject: { label: string; dot: string } }
  | { ok: false; error: string }
> {
  await requireAdmin();
  z.string().uuid().parse(id);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        name: classes.name,
        weekday: classes.weekday,
        isRecurring: classes.isRecurring,
        startTime: classes.startTime,
        endTime: classes.endTime,
        subjectName: subjects.name,
        subjectColor: subjects.color,
        tutorFirst: profiles.firstName,
        tutorLast: profiles.lastName,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .innerJoin(profiles, eq(profiles.id, classes.tutorId))
      .where(eq(classes.id, id));
    if (!row) return { ok: false as const, error: "This class no longer exists." };
    const when =
      row.isRecurring && row.weekday !== null && row.startTime && row.endTime
        ? `${WEEKDAYS[row.weekday]} ${formatTimeRange(row.startTime, row.endTime)}`
        : null;
    return {
      ok: true as const,
      impact: await classDeletionImpact(tx, id, new Date()),
      subject: {
        // The slot already names the class ("Saturday 10:00 – 11:30 am"),
        // so the subject is enough before it.
        label: [
          when ? row.subjectName : classDisplayName(row.subjectName, row.name),
          when,
          `${row.tutorFirst} ${row.tutorLast}`.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
        dot: subjectTone(row.subjectName, row.subjectColor).dot,
      },
    };
  });
}

/**
 * Delete a class and its enrolments and upcoming lessons. Refused while any
 * lesson has attendance, notes or marks: that record is deleted lesson by
 * lesson from Attendance first, never with the class.
 */
export async function deleteClass(id: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);
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
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(eq(classes.id, id))
      .for("update", { of: classes });
    if (!current) return { ok: false as const, error: "This class no longer exists." };

    const impact = await classDeletionImpact(tx, id, now);
    if (impact.recordedLessons > 0) {
      return {
        ok: false as const,
        error: `This class has ${impact.recordedLessons} ${impact.recordedLessons === 1 ? "lesson" : "lessons"} with attendance, notes or marks. Delete those lessons first.`,
      };
    }

    const families = impact.upcomingLessons > 0 ? await classFamilies(tx, id) : null;

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
        { userId: current.tutorId, channel: "in_app" as const, title: "Class removed", body, href: "/tutor/timetable" },
        ...families.studentIds.map((studentId) => ({
          userId: studentId,
          channel: "in_app" as const,
          title: "Class removed",
          body,
          href: "/student/timetable",
        })),
        ...[...families.parentChild].map(([parentId, childId]) => ({
          userId: parentId,
          channel: "in_app" as const,
          title: "Class removed",
          body: families.parentBody(parentId, body),
          href: `/parent?child=${childId}`,
        })),
      ]);
    }
    return { ok: true as const };
  });

  if (result.ok) revalidateSchedules();
  return result;
}
