"use server";

import { revalidatePath } from "next/cache";
import {
  and,
  eq,
  gt,
  gte,
  inArray,
  lte,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  classes,
  lessons,
  notifications,
  profiles,
  subjects,
  tutorCoverRequests,
  tutorLeaveRequests,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatDateLong } from "@/lib/format";
import {
  adminNotificationValues,
  getAdminRecipientIds,
  runTutorCoverReminders,
} from "@/lib/tutor-cover";
import {
  hoursUntilLesson,
  inclusiveDayCount,
  MAX_LEAVE_DAYS,
  melbourneDate,
  MIN_COVER_NOTICE_HOURS,
  tutorCoverLessonDescription,
} from "@/lib/tutor-cover-rules";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const reasonSchema = z.string().trim().min(1, "Please add a reason").max(2000);
const isoCalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid date");
const singleRequestSchema = z.object({
  lessonId: z.string().uuid(),
  reason: reasonSchema,
});
const leaveSchema = z.object({
  startDate: isoCalendarDateSchema,
  endDate: isoCalendarDateSchema,
  reason: reasonSchema,
});

export async function submitSingleCoverRequest(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole("tutor");
  const parsed = singleRequestSchema.safeParse({
    lessonId: formData.get("lessonId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }

  const [lesson] = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      status: lessons.status,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(and(eq(lessons.id, parsed.data.lessonId), eq(lessons.tutorId, user.id)))
    .limit(1);
  if (!lesson || !["upcoming", "makeup"].includes(lesson.status)) {
    return { ok: false, error: "That class is no longer available for cover." };
  }

  const noticeHours = hoursUntilLesson(lesson.date, lesson.startTime);
  if (noticeHours < MIN_COVER_NOTICE_HOURS) {
    return {
      ok: false,
      error: "Cover requests must be submitted at least 48 hours before class.",
    };
  }

  const [[tutor], adminIds] = await Promise.all([
    db
      .select({ firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1),
    getAdminRecipientIds(),
  ]);
  const created = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(tutorCoverRequests)
      .values({
        lessonId: lesson.id,
        originalTutorId: user.id,
        reason: parsed.data.reason,
        status: "open",
      })
      .onConflictDoNothing({ target: tutorCoverRequests.lessonId })
      .returning({ id: tutorCoverRequests.id });
    if (rows.length === 0) return false;
    const adminNotifications = adminNotificationValues(adminIds, {
      title: "Tutor cover request posted",
      body:
        `${tutor?.firstName ?? "A tutor"} ${tutor?.lastName ?? ""} cannot teach ` +
        `${tutorCoverLessonDescription(lesson)}. Reason: ${parsed.data.reason}`,
    });
    if (adminNotifications.length) {
      await tx.insert(notifications).values(adminNotifications);
    }
    return true;
  });
  if (!created) {
    return { ok: false, error: "A cover request already exists for this class." };
  }

  // A request submitted right on the 48-hour boundary should raise its
  // escalation immediately instead of waiting for the next admin poll.
  try {
    await runTutorCoverReminders();
  } catch (error) {
    // The request and its initial admin notification are already committed.
    // Do not report a failed submission merely because the follow-up sweep
    // will need to be retried by the poller or cron.
    console.error("[tutor-cover] post-request reminder sweep failed:", error);
  }

  revalidatePath("/tutor/cover");
  revalidatePath("/admin/reschedules");
  return { ok: true, message: "The class is now on the cover board." };
}

export async function submitTutorLeaveRequest(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole("tutor");
  const parsed = leaveSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const { startDate, endDate, reason } = parsed.data;
  const days = inclusiveDayCount(startDate, endDate);
  if (days <= 0) {
    return { ok: false, error: "The last day must be on or after the first day." };
  }
  if (days < 2) {
    return {
      ok: false,
      error: "Use the single-class form for a one-day absence.",
    };
  }
  if (days > MAX_LEAVE_DAYS) {
    return { ok: false, error: `Leave can cover at most ${MAX_LEAVE_DAYS} days.` };
  }

  const affectedLessons = await db
    .select({
      id: lessons.id,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(lessons.tutorId, user.id),
        gte(lessons.date, startDate),
        lte(lessons.date, endDate),
        inArray(lessons.status, ["upcoming", "makeup"]),
      ),
    );
  const underNotice = affectedLessons.find(
    (lesson) =>
      hoursUntilLesson(lesson.date, lesson.startTime) < MIN_COVER_NOTICE_HOURS,
  );
  if (underNotice) {
    return {
      ok: false,
      error:
        `${tutorCoverLessonDescription(underNotice)} is less than 48 hours away. ` +
        "Contact the office directly.",
    };
  }
  if (
    affectedLessons.length === 0 &&
    hoursUntilLesson(startDate, "00:00:00") < MIN_COVER_NOTICE_HOURS
  ) {
    return { ok: false, error: "Leave must be submitted at least 48 hours ahead." };
  }

  const [[tutor], adminIds] = await Promise.all([
    db
      .select({ firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1),
    getAdminRecipientIds(),
  ]);
  const created = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`tutor-leave:${user.id}`}))`,
    );
    const overlapping = await tx
      .select({ id: tutorLeaveRequests.id })
      .from(tutorLeaveRequests)
      .where(
        and(
          eq(tutorLeaveRequests.tutorId, user.id),
          inArray(tutorLeaveRequests.status, ["pending", "approved"]),
          lte(tutorLeaveRequests.startDate, endDate),
          gte(tutorLeaveRequests.endDate, startDate),
        ),
      )
      .limit(1);
    if (overlapping.length) return false;

    await tx.insert(tutorLeaveRequests).values({
      tutorId: user.id,
      startDate,
      endDate,
      reason,
    });
    const adminNotifications = adminNotificationValues(adminIds, {
      title: "URGENT: Extended tutor leave requires approval",
      body:
        `${tutor?.firstName ?? "A tutor"} ${tutor?.lastName ?? ""} requested ` +
        `${days} days away (${formatDateLong(startDate)}–${formatDateLong(endDate)}). ` +
        `${affectedLessons.length} ${affectedLessons.length === 1 ? "class needs" : "classes need"} review. Reason: ${reason}`,
    });
    if (adminNotifications.length) {
      await tx.insert(notifications).values(adminNotifications);
    }
    return true;
  });
  if (!created) {
    return { ok: false, error: "You already have leave covering these dates." };
  }

  revalidatePath("/tutor/cover");
  revalidatePath("/admin/reschedules");
  revalidatePath("/admin/notifications");
  return { ok: true, message: "Leave sent to admin for approval." };
}

export async function decideTutorLeave(input: {
  leaveRequestId: string;
  decision: "approve" | "reject";
}): Promise<ActionResult> {
  const admin = await requireRole("admin");
  const parsed = z
    .object({
      leaveRequestId: z.string().uuid(),
      decision: z.enum(["approve", "reject"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid leave request." };

  const [leave] = await db
    .select({
      id: tutorLeaveRequests.id,
      tutorId: tutorLeaveRequests.tutorId,
      startDate: tutorLeaveRequests.startDate,
      endDate: tutorLeaveRequests.endDate,
      reason: tutorLeaveRequests.reason,
      status: tutorLeaveRequests.status,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
    })
    .from(tutorLeaveRequests)
    .innerJoin(profiles, eq(profiles.id, tutorLeaveRequests.tutorId))
    .where(eq(tutorLeaveRequests.id, parsed.data.leaveRequestId))
    .limit(1);
  if (!leave || leave.status !== "pending") {
    return { ok: false, error: "This leave request has already been decided." };
  }

  const now = new Date();
  const adminIds = await getAdminRecipientIds();
  if (parsed.data.decision === "reject") {
    const rejected = await db.transaction(async (tx) => {
      const changed = await tx
        .update(tutorLeaveRequests)
        .set({
          status: "rejected",
          decidedById: admin.id,
          decidedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(tutorLeaveRequests.id, leave.id),
            eq(tutorLeaveRequests.status, "pending"),
          ),
        )
        .returning({ id: tutorLeaveRequests.id });
      if (changed.length === 0) return false;
      await tx.insert(notifications).values({
        userId: leave.tutorId,
        channel: "in_app",
        title: "Extended leave request declined",
        body: `Your leave request for ${formatDateLong(leave.startDate)}–${formatDateLong(leave.endDate)} was not approved. Please contact the office.`,
        href: "/tutor/cover",
      });
      return true;
    });
    if (!rejected) {
      return { ok: false, error: "This leave request has already been decided." };
    }
    revalidatePath("/admin/reschedules");
    revalidatePath("/tutor/cover");
    return { ok: true, message: "Leave request rejected." };
  }

  const futureLessons = (
    await db
      .select({
        id: lessons.id,
        date: lessons.date,
        startTime: lessons.startTime,
      })
      .from(lessons)
      .where(
        and(
          eq(lessons.tutorId, leave.tutorId),
          gte(lessons.date, leave.startDate),
          lte(lessons.date, leave.endDate),
          inArray(lessons.status, ["upcoming", "makeup"]),
        ),
      )
  ).filter((lesson) => hoursUntilLesson(lesson.date, lesson.startTime, now) > 0);

  const approved = await db.transaction(async (tx) => {
    const changed = await tx
      .update(tutorLeaveRequests)
      .set({
        status: "approved",
        decidedById: admin.id,
        decidedAt: now,
        lastUncoveredReminderOn: melbourneDate(now),
        updatedAt: now,
      })
      .where(
        and(
          eq(tutorLeaveRequests.id, leave.id),
          eq(tutorLeaveRequests.status, "pending"),
        ),
      )
      .returning({ id: tutorLeaveRequests.id });
    if (changed.length === 0) return false;

    if (futureLessons.length) {
      await tx
        .insert(tutorCoverRequests)
        .values(
          futureLessons.map((lesson) => ({
            lessonId: lesson.id,
            leaveRequestId: leave.id,
            originalTutorId: leave.tutorId,
            reason: leave.reason,
            status: "open" as const,
          })),
        )
        .onConflictDoNothing({ target: tutorCoverRequests.lessonId });
    }

    await tx.insert(notifications).values({
      userId: leave.tutorId,
      channel: "in_app",
      title: "Extended leave approved",
      body:
        `Your leave for ${formatDateLong(leave.startDate)}–${formatDateLong(leave.endDate)} was approved. ` +
        `${futureLessons.length} ${futureLessons.length === 1 ? "class is" : "classes are"} now on the cover board.`,
      href: "/tutor/cover",
    });
    const adminNotifications = adminNotificationValues(adminIds, {
      title: "URGENT: Extended leave approved — coverage needed",
      body:
        `${leave.tutorFirst} ${leave.tutorLast} is away ${formatDateLong(leave.startDate)}–${formatDateLong(leave.endDate)}. ` +
        `${futureLessons.length} ${futureLessons.length === 1 ? "class needs" : "classes need"} replacement cover.`,
    });
    if (adminNotifications.length) {
      await tx.insert(notifications).values(adminNotifications);
    }
    return true;
  });
  if (!approved) {
    return { ok: false, error: "This leave request has already been decided." };
  }

  try {
    await runTutorCoverReminders(now);
  } catch (error) {
    // Approval, cover rows, and the initial urgent notification are already
    // committed. The idempotent poller/cron can safely retry deadline alerts.
    console.error("[tutor-cover] post-approval reminder sweep failed:", error);
  }
  revalidatePath("/admin/reschedules");
  revalidatePath("/admin/notifications");
  revalidatePath("/tutor/cover");
  return { ok: true, message: "Leave approved and classes posted for cover." };
}

async function assignCover(input: {
  coverRequestId: string;
  replacementTutorId: string;
  assignedBy: "tutor" | "admin";
}): Promise<ActionResult> {
  const [replacement] = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.id, input.replacementTutorId),
        eq(profiles.role, "tutor"),
        eq(profiles.isActive, true),
      ),
    )
    .limit(1);
  if (!replacement) return { ok: false, error: "Replacement tutor not found." };

  const [cover] = await db
    .select({
      id: tutorCoverRequests.id,
      lessonId: tutorCoverRequests.lessonId,
      originalTutorId: tutorCoverRequests.originalTutorId,
      replacementTutorId: tutorCoverRequests.replacementTutorId,
      status: tutorCoverRequests.status,
      lessonStatus: lessons.status,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(tutorCoverRequests)
    .innerJoin(lessons, eq(lessons.id, tutorCoverRequests.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(eq(tutorCoverRequests.id, input.coverRequestId))
    .limit(1);
  if (!cover || !["upcoming", "makeup"].includes(cover.lessonStatus)) {
    return { ok: false, error: "This class has already been covered." };
  }
  const canAssignCurrentStatus =
    cover.status === "open" ||
    (input.assignedBy === "admin" && cover.status === "claimed");
  if (!canAssignCurrentStatus) {
    return { ok: false, error: "This class has already been covered." };
  }
  if (cover.originalTutorId === replacement.id) {
    return { ok: false, error: "The original tutor cannot claim their own cover." };
  }
  if (cover.replacementTutorId === replacement.id) {
    return { ok: false, error: "That tutor is already covering this class." };
  }
  if (hoursUntilLesson(cover.date, cover.startTime) <= 0) {
    return { ok: false, error: "This class has already started." };
  }

  const [[original], adminIds] = await Promise.all([
    db
      .select({ firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles)
      .where(eq(profiles.id, cover.originalTutorId))
      .limit(1),
    getAdminRecipientIds(),
  ]);
  const detail = tutorCoverLessonDescription(cover);
  const isReassignment = cover.status === "claimed";

  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`tutor-cover:${replacement.id}:${cover.date}`}))`,
    );
    const conflict = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(
        and(
          eq(lessons.tutorId, replacement.id),
          eq(lessons.date, cover.date),
          ne(lessons.id, cover.lessonId),
          notCancelledLessonStatus(),
          lt(lessons.startTime, cover.endTime),
          gt(lessons.endTime, cover.startTime),
        ),
      )
      .limit(1);
    if (conflict.length) return "conflict" as const;

    const claimed = await tx
      .update(tutorCoverRequests)
      .set({
        status: "claimed",
        replacementTutorId: replacement.id,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tutorCoverRequests.id, cover.id),
          input.assignedBy === "admin"
            ? isReassignment && cover.replacementTutorId
              ? and(
                  eq(tutorCoverRequests.status, "claimed"),
                  eq(
                    tutorCoverRequests.replacementTutorId,
                    cover.replacementTutorId,
                  ),
                )
              : eq(tutorCoverRequests.status, "open")
            : eq(tutorCoverRequests.status, "open"),
        ),
      )
      .returning({ id: tutorCoverRequests.id });
    if (claimed.length === 0) return "taken" as const;
    await tx
      .update(lessons)
      .set({ tutorId: replacement.id })
      .where(eq(lessons.id, cover.lessonId));

    const adminNotifications = adminNotificationValues(adminIds, {
      title:
        input.assignedBy === "admin"
          ? isReassignment
            ? "Cover tutor changed"
            : "Cover assigned"
          : "Tutor cover claimed",
      body:
        `${replacement.firstName} ${replacement.lastName} will cover ${detail} ` +
        `for ${original?.firstName ?? "the original tutor"} ${original?.lastName ?? ""}.`,
    });
    const directNotifications = [
      ...adminNotifications,
      {
        userId: cover.originalTutorId,
        channel: "in_app" as const,
        title: "Your class has been covered",
        body: `${replacement.firstName} ${replacement.lastName} will teach ${detail}.`,
        href: "/tutor/cover",
      },
      {
        userId: replacement.id,
        channel: "in_app" as const,
        title: "Cover confirmed",
        body: `You are now teaching ${detail}. It has been added to your timetable.`,
        href: "/tutor/cover",
      },
    ];
    if (isReassignment && cover.replacementTutorId) {
      directNotifications.push({
        userId: cover.replacementTutorId,
        channel: "in_app" as const,
        title: "Cover assignment changed",
        body: `Admin reassigned ${detail}. You are no longer covering this class.`,
        href: "/tutor/cover",
      });
    }
    await tx.insert(notifications).values(directNotifications);
    return "claimed" as const;
  });

  if (result === "conflict") {
    return { ok: false, error: "That tutor already has a class at this time." };
  }
  if (result === "taken") {
    return { ok: false, error: "Another tutor just claimed this class." };
  }

  revalidatePath("/tutor/cover");
  revalidatePath("/tutor/timetable");
  revalidatePath("/admin/reschedules");
  revalidatePath("/admin/notifications");
  return {
    ok: true,
    message: isReassignment
      ? "Cover tutor changed and everyone was notified."
      : "Cover confirmed and admin notified.",
  };
}

function notCancelledLessonStatus() {
  return inArray(lessons.status, ["upcoming", "makeup"]);
}

export async function claimTutorCover(
  coverRequestId: string,
): Promise<ActionResult> {
  const tutor = await requireRole("tutor");
  const parsed = z.string().uuid().safeParse(coverRequestId);
  if (!parsed.success) return { ok: false, error: "Invalid cover request." };
  return assignCover({
    coverRequestId: parsed.data,
    replacementTutorId: tutor.id,
    assignedBy: "tutor",
  });
}

export async function adminAssignTutorCover(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = z
    .object({
      coverRequestId: z.string().uuid(),
      replacementTutorId: z.string().uuid(),
    })
    .safeParse({
      coverRequestId: formData.get("coverRequestId"),
      replacementTutorId: formData.get("replacementTutorId"),
    });
  if (!parsed.success) return { ok: false, error: "Choose a replacement tutor." };
  return assignCover({ ...parsed.data, assignedBy: "admin" });
}

export async function adminReopenTutorCover(
  formData: FormData,
): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = z.string().uuid().safeParse(formData.get("coverRequestId"));
  if (!parsed.success) return { ok: false, error: "Invalid cover request." };

  const [cover] = await db
    .select({
      id: tutorCoverRequests.id,
      lessonId: tutorCoverRequests.lessonId,
      originalTutorId: tutorCoverRequests.originalTutorId,
      replacementTutorId: tutorCoverRequests.replacementTutorId,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(tutorCoverRequests)
    .innerJoin(lessons, eq(lessons.id, tutorCoverRequests.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(tutorCoverRequests.id, parsed.data),
        eq(tutorCoverRequests.status, "claimed"),
      ),
    )
    .limit(1);
  if (!cover?.replacementTutorId) {
    return { ok: false, error: "This cover assignment is no longer claimed." };
  }
  const replacementTutorId = cover.replacementTutorId;

  const now = new Date();
  const hours = hoursUntilLesson(cover.date, cover.startTime, now);
  if (hours <= 0) {
    return { ok: false, error: "This class has already started." };
  }
  const deadlineFlags =
    hours <= 24
      ? { alert48SentAt: now, alert24SentAt: now }
      : hours <= 48
        ? { alert48SentAt: now }
        : { alert48SentAt: null, alert24SentAt: null };
  const adminIds = await getAdminRecipientIds();
  const detail = tutorCoverLessonDescription(cover);

  const reopened = await db.transaction(async (tx) => {
    const changed = await tx
      .update(tutorCoverRequests)
      .set({
        status: "open",
        replacementTutorId: null,
        claimedAt: null,
        updatedAt: now,
        ...deadlineFlags,
      })
      .where(
        and(
          eq(tutorCoverRequests.id, cover.id),
          eq(tutorCoverRequests.status, "claimed"),
          eq(tutorCoverRequests.replacementTutorId, replacementTutorId),
        ),
      )
      .returning({ id: tutorCoverRequests.id });
    if (changed.length === 0) return false;

    await tx
      .update(lessons)
      .set({ tutorId: cover.originalTutorId })
      .where(eq(lessons.id, cover.lessonId));

    await tx.insert(notifications).values([
      ...adminNotificationValues(adminIds, {
        title: "URGENT: Cover returned to notice board",
        body: `${detail} needs a replacement again.`,
      }),
      {
        userId: cover.originalTutorId,
        channel: "in_app" as const,
        title: "Your class needs cover again",
        body: `${detail} was returned to the cover board by admin.`,
        href: "/tutor/cover",
      },
      {
        userId: replacementTutorId,
        channel: "in_app" as const,
        title: "Cover assignment removed",
        body: `Admin returned ${detail} to the cover board.`,
        href: "/tutor/cover",
      },
    ]);
    return true;
  });
  if (!reopened) {
    return { ok: false, error: "This cover assignment has already changed." };
  }

  revalidatePath("/tutor/cover");
  revalidatePath("/tutor/timetable");
  revalidatePath("/admin/reschedules");
  revalidatePath("/admin/notifications");
  return { ok: true, message: "The class is available on the cover board again." };
}

export async function releaseTutorCover(
  coverRequestId: string,
): Promise<ActionResult> {
  const tutor = await requireRole("tutor");
  const parsed = z.string().uuid().safeParse(coverRequestId);
  if (!parsed.success) return { ok: false, error: "Invalid cover request." };

  const [cover] = await db
    .select({
      id: tutorCoverRequests.id,
      lessonId: tutorCoverRequests.lessonId,
      originalTutorId: tutorCoverRequests.originalTutorId,
      replacementTutorId: tutorCoverRequests.replacementTutorId,
      date: lessons.date,
      startTime: lessons.startTime,
      endTime: lessons.endTime,
      className: classes.name,
      subjectName: subjects.name,
    })
    .from(tutorCoverRequests)
    .innerJoin(lessons, eq(lessons.id, tutorCoverRequests.lessonId))
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .where(
      and(
        eq(tutorCoverRequests.id, parsed.data),
        eq(tutorCoverRequests.status, "claimed"),
        eq(tutorCoverRequests.replacementTutorId, tutor.id),
      ),
    )
    .limit(1);
  if (!cover) return { ok: false, error: "This cover assignment was not found." };

  const now = new Date();
  const hours = hoursUntilLesson(cover.date, cover.startTime, now);
  if (hours <= 0) {
    return { ok: false, error: "This class has already started." };
  }
  const deadlineFlags =
    hours <= 24
      ? { alert48SentAt: now, alert24SentAt: now }
      : hours <= 48
        ? { alert48SentAt: now }
        : { alert48SentAt: null, alert24SentAt: null };
  const adminIds = await getAdminRecipientIds();
  const reopened = await db.transaction(async (tx) => {
    const changed = await tx
      .update(tutorCoverRequests)
      .set({
        status: "open",
        replacementTutorId: null,
        claimedAt: null,
        updatedAt: now,
        ...deadlineFlags,
      })
      .where(
        and(
          eq(tutorCoverRequests.id, cover.id),
          eq(tutorCoverRequests.status, "claimed"),
          eq(tutorCoverRequests.replacementTutorId, tutor.id),
        ),
      )
      .returning({ id: tutorCoverRequests.id });
    if (changed.length === 0) return false;
    await tx
      .update(lessons)
      .set({ tutorId: cover.originalTutorId })
      .where(eq(lessons.id, cover.lessonId));
    const adminNotifications = adminNotificationValues(adminIds, {
      title: "URGENT: Claimed cover was released",
      body: `${tutorCoverLessonDescription(cover)} needs a replacement again.`,
    });
    if (adminNotifications.length) {
      await tx.insert(notifications).values(adminNotifications);
    }
    return true;
  });
  if (!reopened) {
    return { ok: false, error: "This cover assignment has already changed." };
  }

  revalidatePath("/tutor/cover");
  revalidatePath("/tutor/timetable");
  revalidatePath("/admin/reschedules");
  return { ok: true, message: "Cover released and admin notified." };
}

/** Called by the admin shell's quiet poller; auth is rechecked every time. */
export async function syncAdminCoverAlerts() {
  await requireRole("admin");
  const result = await runTutorCoverReminders();
  if (result.sent > 0) revalidatePath("/admin/notifications");
  return { ok: true as const, ...result };
}
