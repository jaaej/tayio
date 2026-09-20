"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  classes,
  enrollments,
  notifications,
  profiles,
  studentLeave,
  type UserRole,
} from "@/db/schema";
import { requireAdmin } from "./guard";
import { withActor } from "@/lib/with-actor";
import { ADMIN_TIERS, coarseRole } from "@/lib/roles";
import { validateLeaveRange } from "@/lib/student-leave";
import { formatDateLong } from "@/lib/format";

const addSchema = z.object({
  studentId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(200).optional(),
});

const ADMIN_ROLES = ["admin", ...ADMIN_TIERS] as UserRole[];

async function getLeaveNotificationContext(studentId: string) {
  const [studentRows, tutorRows, adminRows] = await Promise.all([
    db
      .select({
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        role: profiles.role,
      })
      .from(profiles)
      .where(eq(profiles.id, studentId))
      .limit(1),
    db
      .selectDistinct({ id: classes.tutorId })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          isNull(enrollments.withdrawnAt),
        ),
      ),
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(
        and(
          inArray(profiles.role, ADMIN_ROLES),
          eq(profiles.isActive, true),
        ),
      ),
  ]);

  return {
    student: studentRows[0] ?? null,
    tutorIds: tutorRows.map((row) => row.id),
    adminIds: adminRows.map((row) => row.id),
  };
}

function leaveNotificationValues(input: {
  event: "added" | "removed";
  leaveId: string;
  studentId: string;
  studentName: string;
  startDate: string;
  endDate: string;
  note: string | null;
  tutorIds: string[];
  adminIds: string[];
}) {
  const dates =
    input.startDate === input.endDate
      ? formatDateLong(input.startDate)
      : `${formatDateLong(input.startDate)}–${formatDateLong(input.endDate)}`;
  const title =
    input.event === "added" ? "Student break scheduled" : "Student break removed";
  const body =
    input.event === "added"
      ? `${input.studentName} will be away ${dates}. Their classes continue; attendance rolls will identify them as on leave.${input.note ? ` Note: ${input.note}` : ""}`
      : `${input.studentName}'s recorded break for ${dates} was removed. They are expected on affected attendance rolls again.`;

  return [
    ...input.adminIds.map((userId) => ({
      userId,
      channel: "in_app" as const,
      title,
      body,
      href: `/admin/users/${input.studentId}?tab=lessons`,
      dedupeKey: `student-leave-${input.event}:${input.leaveId}:admin`,
    })),
    ...input.tutorIds.map((userId) => ({
      userId,
      channel: "in_app" as const,
      title,
      body,
      href: `/tutor/students/${input.studentId}`,
      dedupeKey: `student-leave-${input.event}:${input.leaveId}:tutor`,
    })),
  ];
}

/** Record a leave/holiday period for a student. Admin-only, audited. */
export async function addStudentLeave(input: z.infer<typeof addSchema>) {
  const user = await requireAdmin();
  const data = addSchema.parse(input);

  const rangeError = validateLeaveRange(data.startDate, data.endDate);
  if (rangeError) return { ok: false as const, error: rangeError };

  const context = await getLeaveNotificationContext(data.studentId);
  const target = context.student;
  if (!target || coarseRole(target.role) !== "student") {
    return { ok: false as const, error: "That account is not a student." };
  }

  const note = data.note?.trim();
  await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const [created] = await tx
      .insert(studentLeave)
      .values({
        studentId: data.studentId,
        startDate: data.startDate,
        endDate: data.endDate,
        note: note && note.length > 0 ? note : null,
        createdById: user.id,
      })
      .returning({ id: studentLeave.id });
    const notificationRows = leaveNotificationValues({
      event: "added",
      leaveId: created.id,
      studentId: data.studentId,
      studentName: `${target.firstName} ${target.lastName}`.trim(),
      startDate: data.startDate,
      endDate: data.endDate,
      note: note || null,
      tutorIds: context.tutorIds,
      adminIds: context.adminIds,
    });
    if (notificationRows.length) {
      await tx.insert(notifications).values(notificationRows).onConflictDoNothing();
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/notifications");
  revalidatePath(`/admin/users/${data.studentId}`);
  revalidatePath("/tutor/notifications");
  return { ok: true as const };
}

/** Remove a leave period. Admin-only, audited. */
export async function removeStudentLeave(id: string, studentId: string) {
  const user = await requireAdmin();
  z.string().uuid().parse(id);
  z.string().uuid().parse(studentId);

  const [leaveRows, context] = await Promise.all([
    db
      .select({
        startDate: studentLeave.startDate,
        endDate: studentLeave.endDate,
        note: studentLeave.note,
      })
      .from(studentLeave)
      .where(and(eq(studentLeave.id, id), eq(studentLeave.studentId, studentId)))
      .limit(1),
    getLeaveNotificationContext(studentId),
  ]);
  const leave = leaveRows[0];
  if (!leave || !context.student) {
    return { ok: false as const, error: "That leave period no longer exists." };
  }

  await withActor({ id: user.id, role: "admin" }, async (tx) => {
    const removed = await tx
      .delete(studentLeave)
      .where(and(eq(studentLeave.id, id), eq(studentLeave.studentId, studentId)))
      .returning({ id: studentLeave.id });
    if (removed.length === 0) return;
    const notificationRows = leaveNotificationValues({
      event: "removed",
      leaveId: id,
      studentId,
      studentName: `${context.student.firstName} ${context.student.lastName}`.trim(),
      startDate: leave.startDate,
      endDate: leave.endDate,
      note: leave.note,
      tutorIds: context.tutorIds,
      adminIds: context.adminIds,
    });
    if (notificationRows.length) {
      await tx.insert(notifications).values(notificationRows).onConflictDoNothing();
    }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/notifications");
  revalidatePath(`/admin/users/${studentId}`);
  revalidatePath("/tutor/notifications");
  return { ok: true as const };
}
