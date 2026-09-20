"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import {
  classes,
  classMoveRequests,
  enrollments,
  familyLinks,
  notifications,
  profiles,
  subjects,
  type UserRole,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { classDisplayName } from "@/lib/class-display";
import {
  classScheduleLabel,
  validateClassMove,
} from "@/lib/class-move-rules";
import { ADMIN_TIERS, coarseRole } from "@/lib/roles";
import { withActor } from "@/lib/with-actor";

type Result = { ok: true; message: string } | { ok: false; error: string };

const requestSchema = z.object({
  studentId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
  reason: z.string().trim().min(5, "Give the office a short reason.").max(2000),
});

const adminMoveSchema = requestSchema.extend({
  reason: z.string().trim().min(1).max(2000),
});

const decisionSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().trim().max(2000).optional(),
});

function revalidateMovePaths(studentId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${studentId}`);
  revalidatePath("/admin/notifications");
  revalidatePath("/student/timetable");
  revalidatePath("/student/notifications");
  revalidatePath("/parent/classes");
  revalidatePath("/parent/notifications");
}

async function resolveOwnedStudent(
  actor: { id: string; app_metadata?: Record<string, unknown> },
  studentId: string,
): Promise<boolean> {
  const role = coarseRole(actor.app_metadata?.role as UserRole);
  if (role === "student") return actor.id === studentId;
  if (role !== "parent") return false;
  const [link] = await db
    .select({ studentId: familyLinks.studentId })
    .from(familyLinks)
    .where(
      and(
        eq(familyLinks.parentId, actor.id),
        eq(familyLinks.studentId, studentId),
      ),
    )
    .limit(1);
  return !!link;
}

async function getActiveAdminIds(): Promise<string[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(inArray(profiles.role, [...ADMIN_TIERS]), eq(profiles.isActive, true)),
    );
  return rows.map((row) => row.id);
}

async function notificationRecipients(studentId: string): Promise<string[]> {
  const [student, parents] = await Promise.all([
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, studentId))
      .limit(1),
    db
      .select({ id: familyLinks.parentId })
      .from(familyLinks)
      .where(eq(familyLinks.studentId, studentId)),
  ]);
  return [...new Set([...student.map((row) => row.id), ...parents.map((row) => row.id)])];
}

type MoveSummary = {
  studentId: string;
  studentName: string;
  requestedById: string;
  fromLabel: string;
  fromSchedule: string;
  toLabel: string;
  toSchedule: string;
  sourceTutorId: string;
  targetTutorId: string;
};

function notificationHref(role: UserRole, studentId: string): string {
  const family = coarseRole(role);
  if (family === "student") return "/student/timetable";
  if (family === "parent") return "/parent/classes";
  if (family === "tutor") return "/tutor/classes";
  return `/admin/users/${studentId}?tab=lessons#class-moves`;
}

async function executeMove(input: {
  adminId: string;
  studentId: string;
  requestedById: string;
  fromClassId: string;
  toClassId: string;
  reason: string;
  requestId?: string;
}): Promise<MoveSummary> {
  return withActor({ id: input.adminId, role: "admin" }, async (tx) => {
    // Serialise approvals/manual moves for a target so two admins cannot both
    // consume its last available seat.
    await tx.execute(
      sql`select id from ${classes} where id = ${input.toClassId} for update`,
    );
    if (input.requestId) {
      await tx.execute(
        sql`select id from ${classMoveRequests} where id = ${input.requestId} for update`,
      );
      const [request] = await tx
        .select({ status: classMoveRequests.status })
        .from(classMoveRequests)
        .where(eq(classMoveRequests.id, input.requestId))
        .limit(1);
      if (!request || request.status !== "pending") {
        throw new Error("This class-move request has already been decided.");
      }
    }

    const tutor = alias(profiles, "move_action_tutor");
    const [source] = await tx
      .select({
        classId: classes.id,
        className: classes.name,
        subjectId: classes.subjectId,
        subjectName: subjects.name,
        tutorId: classes.tutorId,
        weekday: classes.weekday,
        startTime: classes.startTime,
        endTime: classes.endTime,
        deliveryMode: enrollments.deliveryMode,
        adminNotes: enrollments.adminNotes,
      })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .where(
        and(
          eq(enrollments.studentId, input.studentId),
          eq(enrollments.classId, input.fromClassId),
          isNull(enrollments.withdrawnAt),
        ),
      )
      .limit(1);

    const [target] = await tx
      .select({
        classId: classes.id,
        className: classes.name,
        subjectId: classes.subjectId,
        subjectName: subjects.name,
        tutorId: classes.tutorId,
        tutorFirst: tutor.firstName,
        tutorLast: tutor.lastName,
        weekday: classes.weekday,
        startTime: classes.startTime,
        endTime: classes.endTime,
        capacity: classes.capacity,
        isRecurring: classes.isRecurring,
      })
      .from(classes)
      .innerJoin(subjects, eq(subjects.id, classes.subjectId))
      .innerJoin(tutor, eq(tutor.id, classes.tutorId))
      .where(eq(classes.id, input.toClassId))
      .limit(1);

    const [targetEnrolment, targetCount, student] = await Promise.all([
      tx
        .select({ withdrawnAt: enrollments.withdrawnAt })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, input.studentId),
            eq(enrollments.classId, input.toClassId),
          ),
        )
        .limit(1),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.classId, input.toClassId),
            isNull(enrollments.withdrawnAt),
          ),
        ),
      tx
        .select({ firstName: profiles.firstName, lastName: profiles.lastName })
        .from(profiles)
        .where(eq(profiles.id, input.studentId))
        .limit(1),
    ]);

    if (!target || student.length === 0) {
      throw new Error("Class or student not found.");
    }
    const validationError = validateClassMove({
      fromClassId: input.fromClassId,
      toClassId: input.toClassId,
      fromSubjectId: source?.subjectId ?? "",
      toSubjectId: target.subjectId,
      sourceEnrolmentActive: !!source,
      targetEnrolmentActive:
        !!targetEnrolment[0] && targetEnrolment[0].withdrawnAt === null,
      targetIsRecurring: target.isRecurring,
      targetHasCapacity: Number(targetCount[0]?.count ?? 0) < target.capacity,
    });
    if (validationError) throw new Error(validationError);

    const movedAt = new Date();
    await tx
      .update(enrollments)
      .set({ withdrawnAt: movedAt })
      .where(
        and(
          eq(enrollments.studentId, input.studentId),
          eq(enrollments.classId, input.fromClassId),
          isNull(enrollments.withdrawnAt),
        ),
      );

    if (targetEnrolment.length > 0) {
      await tx
        .update(enrollments)
        .set({
          withdrawnAt: null,
          enrolledAt: movedAt,
          deliveryMode: source?.deliveryMode ?? null,
        })
        .where(
          and(
            eq(enrollments.studentId, input.studentId),
            eq(enrollments.classId, input.toClassId),
          ),
        );
    } else {
      await tx.insert(enrollments).values({
        studentId: input.studentId,
        classId: input.toClassId,
        enrolledAt: movedAt,
        deliveryMode: source?.deliveryMode ?? null,
        adminNotes: source?.adminNotes ?? null,
      });
    }

    if (input.requestId) {
      await tx
        .update(classMoveRequests)
        .set({
          status: "approved",
          decidedById: input.adminId,
          decidedAt: movedAt,
          updatedAt: movedAt,
        })
        .where(eq(classMoveRequests.id, input.requestId));
    } else {
      await tx
        .update(classMoveRequests)
        .set({
          status: "cancelled",
          decidedById: input.adminId,
          decidedAt: movedAt,
          updatedAt: movedAt,
        })
        .where(
          and(
            eq(classMoveRequests.studentId, input.studentId),
            eq(classMoveRequests.fromClassId, input.fromClassId),
            eq(classMoveRequests.status, "pending"),
          ),
        );
      await tx.insert(classMoveRequests).values({
        studentId: input.studentId,
        requestedById: input.requestedById,
        fromClassId: input.fromClassId,
        toClassId: input.toClassId,
        reason: input.reason,
        status: "approved",
        decidedById: input.adminId,
        decidedAt: movedAt,
        updatedAt: movedAt,
      });
    }

    const person = student[0];
    const summary: MoveSummary = {
      studentId: input.studentId,
      studentName: `${person.firstName} ${person.lastName}`.trim(),
      requestedById: input.requestedById,
      fromLabel: classDisplayName(source!.subjectName, source!.className),
      fromSchedule: classScheduleLabel(source!),
      toLabel: classDisplayName(target.subjectName, target.className),
      toSchedule: classScheduleLabel(target),
      sourceTutorId: source!.tutorId,
      targetTutorId: target.tutorId,
    };

    // Notifications are part of the same transaction as the enrolment move:
    // the UI can never report success while silently losing the operational
    // message admins/families depend on.
    const parentRows = await tx
      .select({ id: familyLinks.parentId })
      .from(familyLinks)
      .where(eq(familyLinks.studentId, input.studentId));
    const recipientIds = [
      ...new Set([
        input.studentId,
        ...parentRows.map((row) => row.id),
        input.requestedById,
        source!.tutorId,
        target.tutorId,
      ]),
    ];
    const recipientRows = await tx
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(inArray(profiles.id, recipientIds));
    const notificationBody =
      `${summary.studentName} has permanently moved from ${summary.fromLabel} ` +
      `(${summary.fromSchedule}) to ${summary.toLabel} (${summary.toSchedule}).`;
    if (recipientRows.length > 0) {
      await tx.insert(notifications).values(
        recipientRows.map((recipient) => ({
          userId: recipient.id,
          channel: "in_app" as const,
          title: "Permanent class move approved",
          body: notificationBody,
          href: notificationHref(recipient.role, input.studentId),
        })),
      );
    }

    return summary;
  });
}

export async function requestPermanentClassMove(
  input: z.infer<typeof requestSchema>,
): Promise<Result> {
  const actor = await requireRole(["student", "parent"]);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the request.",
    };
  }
  const data = parsed.data;
  if (!(await resolveOwnedStudent(actor, data.studentId))) {
    return { ok: false, error: "You cannot request a move for this student." };
  }

  const tutor = alias(profiles, "move_request_tutor");
  const [source] = await db
    .select({
      subjectId: classes.subjectId,
      subjectName: subjects.name,
      className: classes.name,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(enrollments.studentId, data.studentId),
        eq(enrollments.classId, data.fromClassId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .limit(1);
  const [target] = await db
    .select({
      subjectId: classes.subjectId,
      subjectName: subjects.name,
      className: classes.name,
      weekday: classes.weekday,
      startTime: classes.startTime,
      endTime: classes.endTime,
      capacity: classes.capacity,
      isRecurring: classes.isRecurring,
      tutorFirst: tutor.firstName,
      tutorLast: tutor.lastName,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(tutor, eq(tutor.id, classes.tutorId))
    .where(eq(classes.id, data.toClassId))
    .limit(1);
  if (!source || !target) return { ok: false, error: "Class not found." };

  const [targetActive, targetCount, existingPending, requester, student] =
    await Promise.all([
      db
        .select({ id: enrollments.classId })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, data.studentId),
            eq(enrollments.classId, data.toClassId),
            isNull(enrollments.withdrawnAt),
          ),
        )
        .limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.classId, data.toClassId),
            isNull(enrollments.withdrawnAt),
          ),
        ),
      db
        .select({ id: classMoveRequests.id })
        .from(classMoveRequests)
        .where(
          and(
            eq(classMoveRequests.studentId, data.studentId),
            eq(classMoveRequests.fromClassId, data.fromClassId),
            eq(classMoveRequests.status, "pending"),
          ),
        )
        .limit(1),
      db
        .select({
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          email: profiles.email,
          phone: profiles.phone,
        })
        .from(profiles)
        .where(eq(profiles.id, actor.id))
        .limit(1),
      db
        .select({ firstName: profiles.firstName, lastName: profiles.lastName })
        .from(profiles)
        .where(eq(profiles.id, data.studentId))
        .limit(1),
    ]);

  if (existingPending.length > 0) {
    return {
      ok: false,
      error: "A permanent move request is already pending for this class.",
    };
  }
  const validationError = validateClassMove({
    fromClassId: data.fromClassId,
    toClassId: data.toClassId,
    fromSubjectId: source.subjectId,
    toSubjectId: target.subjectId,
    sourceEnrolmentActive: true,
    targetEnrolmentActive: targetActive.length > 0,
    targetIsRecurring: target.isRecurring,
    targetHasCapacity: Number(targetCount[0]?.count ?? 0) < target.capacity,
  });
  if (validationError) return { ok: false, error: validationError };
  if (!requester[0] || !student[0]) {
    return { ok: false, error: "Account not found." };
  }

  const studentName = `${student[0].firstName} ${student[0].lastName}`.trim();
  const requesterName = `${requester[0].firstName} ${requester[0].lastName}`.trim();
  const sourceLabel = classDisplayName(source.subjectName, source.className);
  const targetLabel = classDisplayName(target.subjectName, target.className);
  const contact = [requester[0].email, requester[0].phone]
    .filter(Boolean)
    .join(" · ");
  const body =
    `${studentName} requested a permanent move from ${sourceLabel} ` +
    `(${classScheduleLabel(source)}) to ${targetLabel} (${classScheduleLabel(target)}). ` +
    `Requested by ${requesterName}${contact ? ` (${contact})` : ""}. Reason: ${data.reason}`;
  const adminIds = await getActiveAdminIds();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(classMoveRequests).values({
        studentId: data.studentId,
        requestedById: actor.id,
        fromClassId: data.fromClassId,
        toClassId: data.toClassId,
        reason: data.reason,
      });
      if (adminIds.length > 0) {
        await tx.insert(notifications).values(
          adminIds.map((userId) => ({
            userId,
            channel: "in_app" as const,
            title: `Relocate class time for ${studentName}`,
            body,
            href: `/admin/users/${data.studentId}?tab=lessons#class-moves`,
          })),
        );
      }
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    return {
      ok: false,
      error:
        code === "23505"
          ? "A permanent move request is already pending for this class."
          : "The move request could not be saved. Please try again.",
    };
  }
  revalidateMovePaths(data.studentId);
  return { ok: true, message: "Move request sent to the office." };
}

export async function approvePermanentClassMove(
  input: z.infer<typeof decisionSchema>,
): Promise<Result> {
  const admin = await requireRole("admin");
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const [request] = await db
    .select()
    .from(classMoveRequests)
    .where(eq(classMoveRequests.id, parsed.data.requestId))
    .limit(1);
  if (!request) return { ok: false, error: "Request not found." };
  try {
    await executeMove({
      adminId: admin.id,
      studentId: request.studentId,
      requestedById: request.requestedById,
      fromClassId: request.fromClassId,
      toClassId: request.toClassId,
      reason: request.reason,
      requestId: request.id,
    });
    revalidateMovePaths(request.studentId);
    return { ok: true, message: "Student moved to the new recurring class." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Move failed.",
    };
  }
}

export async function rejectPermanentClassMove(
  input: z.infer<typeof decisionSchema>,
): Promise<Result> {
  const admin = await requireRole("admin");
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const [request] = await db
    .select()
    .from(classMoveRequests)
    .where(eq(classMoveRequests.id, parsed.data.requestId))
    .limit(1);
  if (!request || request.status !== "pending") {
    return { ok: false, error: "This request has already been decided." };
  }
  const recipients = await notificationRecipients(request.studentId);
  try {
    await withActor({ id: admin.id, role: "admin" }, async (tx) => {
      await tx.execute(
        sql`select id from ${classMoveRequests} where id = ${request.id} for update`,
      );
      const [locked] = await tx
        .select({ status: classMoveRequests.status })
        .from(classMoveRequests)
        .where(eq(classMoveRequests.id, request.id))
        .limit(1);
      if (!locked || locked.status !== "pending") {
        throw new Error("This request has already been decided.");
      }
      const now = new Date();
      await tx
        .update(classMoveRequests)
        .set({
          status: "rejected",
          decidedById: admin.id,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(classMoveRequests.id, request.id));
      if (recipients.length > 0) {
        await tx.insert(notifications).values(
          recipients.map((userId) => ({
            userId,
            channel: "in_app" as const,
            title: "Permanent class move declined",
            body: parsed.data.note
              ? `The office declined the permanent class-move request: ${parsed.data.note}`
              : "The office declined the permanent class-move request. Contact the office if you would like to discuss another time.",
            href:
              userId === request.studentId
                ? "/student/timetable"
                : "/parent/classes",
          })),
        );
      }
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "The request could not be declined.",
    };
  }
  revalidateMovePaths(request.studentId);
  return { ok: true, message: "Request declined." };
}

export async function adminMoveStudent(
  input: z.infer<typeof adminMoveSchema>,
): Promise<Result> {
  const admin = await requireRole("admin");
  const parsed = adminMoveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the move details.",
    };
  }
  try {
    await executeMove({
      adminId: admin.id,
      studentId: parsed.data.studentId,
      requestedById: admin.id,
      fromClassId: parsed.data.fromClassId,
      toClassId: parsed.data.toClassId,
      reason: parsed.data.reason,
    });
    revalidateMovePaths(parsed.data.studentId);
    return {
      ok: true,
      message: "Student moved and everyone affected was notified.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Move failed.",
    };
  }
}
