"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  announcements,
  attendance,
  attendanceStatusEnum,
  classes,
  dmMessages,
  dmThreads,
  enrollments,
  homework,
  homeworkAssignments,
  homeworkStatusEnum,
  lessonNotes,
  lessons,
  notifications,
  profiles,
  rescheduleRequests,
  resources,
  subjects,
  subjectWeeks,
  tutorAvailability,
  tutorWeekAttachments,
  tutorWeekSections,
} from "@/db/schema";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { requireRole } from "@/lib/auth";
import { BUCKET, removeCurriculumObject } from "@/lib/curriculum-storage";
import {
  discardDirectUpload,
  createDirectUploadGrant,
  finalizeDirectUpload,
} from "@/lib/direct-upload";
import {
  ATTACHMENT_POLICY,
  validateUploadMetadata,
  HOMEWORK_POLICY,
} from "@/lib/upload-validation";
import { optionalText, requiredText } from "@/lib/validation";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import { withActor } from "@/lib/with-actor";
import { canDM } from "@/lib/dm-permissions";
import { getOrCreateThread } from "@/lib/dm-queries";
import { coarseRole } from "@/lib/roles";
import { rateLimit } from "@/lib/rate-limit";
import { buildHomeworkBumpMessage } from "@/lib/homework-bump";
import { classDisplayName } from "@/lib/class-display";
import type { UserRole } from "@/db/schema";
import { randomUUID } from "node:crypto";
import { requireTutor } from "./_data";

const HOMEWORK_BUCKET = "homework-attachments";
const TUTOR_HOMEWORK_UPLOAD_PURPOSE = "tutor-homework-attachment";
const TUTOR_HOMEWORK_EDIT_UPLOAD_PURPOSE = "tutor-homework-edit-attachment";

const attendanceStatusSchema = z.enum(attendanceStatusEnum.enumValues);
const homeworkStatusSchema = z.enum(homeworkStatusEnum.enumValues);
const directFileSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().positive(),
});
const homeworkEditFileSchema = directFileSchema
  .omit({ classId: true, subjectWeekId: true })
  .extend({ homeworkId: z.string().uuid() });

async function assertOwnsLesson(tutorId: string, lessonId: string) {
  const [row] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.tutorId, tutorId)))
    .limit(1);
  if (!row) throw new Error("Lesson not found");
}

async function assertOwnsClass(tutorId: string, classId: string) {
  const [row] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.tutorId, tutorId)))
    .limit(1);
  if (!row) throw new Error("Class not found");
}

async function assertOwnsHomework(tutorId: string, homeworkId: string) {
  const [row] = await db
    .select({ id: homework.id })
    .from(homework)
    .where(and(eq(homework.id, homeworkId), eq(homework.tutorId, tutorId)))
    .limit(1);
  if (!row) throw new Error("Homework not found");
}

async function assertTeachesStudent(tutorId: string, studentId: string) {
  const tutorClasses = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.tutorId, tutorId));
  if (tutorClasses.length === 0) throw new Error("Not authorised");
  const [row] = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        inArray(
          enrollments.classId,
          tutorClasses.map((c) => c.id),
        ),
        eq(enrollments.studentId, studentId),
        isNull(enrollments.withdrawnAt),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Not authorised");
}

/**
 * Lesson-scoped permission for attendance and notes. A temporary make-up
 * attendee may not be enrolled in any class normally taught by this tutor,
 * but an approved reschedule into this exact lesson still puts them on this
 * tutor's roll for this lesson only.
 */
async function assertCanManageLessonStudent(
  tutorId: string,
  lessonId: string,
  studentId: string,
) {
  const [regular, makeup] = await Promise.all([
    db
      .select({ id: enrollments.studentId })
      .from(lessons)
      .innerJoin(
        enrollments,
        and(
          eq(enrollments.classId, lessons.classId),
          isNull(enrollments.withdrawnAt),
        ),
      )
      .where(
        and(
          eq(lessons.id, lessonId),
          eq(lessons.tutorId, tutorId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1),
    db
      .select({ id: rescheduleRequests.id })
      .from(rescheduleRequests)
      .innerJoin(lessons, eq(lessons.id, rescheduleRequests.targetLessonId))
      .where(
        and(
          eq(lessons.id, lessonId),
          eq(lessons.tutorId, tutorId),
          eq(rescheduleRequests.studentId, studentId),
          eq(rescheduleRequests.status, "approved"),
        ),
      )
      .limit(1),
  ]);

  if (!regular[0] && !makeup[0]) throw new Error("Not authorised");
}

/** Send a task-specific reminder from the dashboard's Students to bump card.
 * The server reloads the overdue work and tutor/student relationship, so a
 * forged student id or stale browser card cannot send an arbitrary message. */
export async function sendHomeworkBump(studentIdInput: string) {
  const tutor = await requireTutor();
  const studentId = z.string().uuid().parse(studentIdInput);

  if (
    !(await rateLimit({
      bucket: "homework_bump",
      identifier: tutor.id,
      max: 20,
      windowSeconds: 60,
    }))
  ) {
    return { ok: false as const, error: "Too many reminders. Wait a moment." };
  }

  await assertTeachesStudent(tutor.id, studentId);
  const today = melbourneDate(new Date());
  const [overdue, student, tutorProfile] = await Promise.all([
    db
      .select({ title: homework.title })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .where(
        and(
          eq(homework.tutorId, tutor.id),
          eq(homeworkAssignments.studentId, studentId),
          inArray(homeworkAssignments.status, [
            "not_started",
            "viewed",
            "resubmission_requested",
          ]),
          sql`${homework.dueDate} < ${today}::timestamp`,
        ),
      )
      .orderBy(homework.dueDate)
      .limit(20),
    db
      .select({
        firstName: profiles.firstName,
        role: profiles.role,
        isActive: profiles.isActive,
      })
      .from(profiles)
      .where(eq(profiles.id, studentId))
      .limit(1),
    db
      .select({ firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles)
      .where(eq(profiles.id, tutor.id))
      .limit(1),
  ]);

  const target = student[0];
  if (
    !target ||
    !target.isActive ||
    coarseRole(target.role) !== "student" ||
    !(await canDM(tutor.id, "tutor", studentId, target.role as UserRole))
  ) {
    return { ok: false as const, error: "This student can’t receive a reminder." };
  }
  if (overdue.length === 0) {
    return { ok: false as const, error: "This student no longer has overdue work." };
  }

  const body = buildHomeworkBumpMessage({
    studentFirstName: target.firstName,
    homeworkTitles: overdue.map((item) => item.title),
  });
  const threadId = await getOrCreateThread(tutor.id, studentId);

  await db.transaction(async (tx) => {
    await tx.insert(dmMessages).values({
      threadId,
      senderId: tutor.id,
      body,
    });
    await tx
      .update(dmThreads)
      .set({ lastActivityAt: new Date() })
      .where(eq(dmThreads.id, threadId));
  });

  const recipientHref = `/student/messages/${threadId}`;
  const [unreadNotification] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, studentId),
        eq(notifications.href, recipientHref),
        isNull(notifications.readAt),
      ),
    )
    .limit(1);
  if (!unreadNotification) {
    const tutorName = tutorProfile[0]
      ? `${tutorProfile[0].firstName} ${tutorProfile[0].lastName}`.trim()
      : "Your tutor";
    await db.insert(notifications).values({
      userId: studentId,
      channel: "in_app",
      title: `Homework reminder from ${tutorName}`,
      body: overdue.length === 1 ? overdue[0].title : `${overdue.length} overdue tasks`,
      href: recipientHref,
    });
  }

  revalidatePath("/tutor");
  revalidatePath("/tutor/messages");
  revalidatePath(recipientHref);
  return { ok: true as const, threadId };
}

export async function saveAttendance(formData: FormData) {
  const tutor = await requireTutor();
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) throw new Error("Missing lessonId");
  await assertOwnsLesson(tutor.id, lessonId);

  // Iterate each "status[<studentId>]" pair
  const entries: { studentId: string; status: string; note: string | null }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^status\[(.+)\]$/);
    if (!match) continue;
    const studentId = match[1];
    const status = String(value ?? "");
    if (!status) continue;
    const note = optionalText(formData.get(`note[${studentId}]`), 2000);
    entries.push({ studentId, status, note });
  }

  for (const entry of entries) {
    const parsed = attendanceStatusSchema.safeParse(entry.status);
    if (!parsed.success) continue;
    await assertCanManageLessonStudent(tutor.id, lessonId, entry.studentId);
    await db
      .insert(attendance)
      .values({
        lessonId,
        studentId: entry.studentId,
        status: parsed.data,
        note: entry.note || null,
        markedBy: tutor.id,
      })
      .onConflictDoUpdate({
        target: [attendance.lessonId, attendance.studentId],
        set: {
          status: parsed.data,
          note: entry.note || null,
          markedBy: tutor.id,
          markedAt: new Date(),
        },
      });
  }

  revalidatePath(`/tutor/lessons/${lessonId}`);
  revalidatePath("/tutor");
}

export async function saveLessonNote(formData: FormData) {
  const tutor = await requireTutor();
  const lessonId = String(formData.get("lessonId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  if (!lessonId || !studentId) throw new Error("Missing lessonId or studentId");
  await assertOwnsLesson(tutor.id, lessonId);
  await assertCanManageLessonStudent(tutor.id, lessonId, studentId);

  const data = {
    topicCovered: optionalText(formData.get("topicCovered"), 5000),
    performance: optionalText(formData.get("performance"), 5000),
    strengths: optionalText(formData.get("strengths"), 5000),
    struggles: optionalText(formData.get("struggles"), 5000),
    nextLessonFocus: optionalText(formData.get("nextLessonFocus"), 5000),
    parentVisibleComment: optionalText(formData.get("parentVisibleComment"), 5000),
    internalNote: optionalText(formData.get("internalNote"), 5000),
  };

  // Upsert by (lessonId, studentId, tutorId) - schema has no unique on those,
  // so do a delete-then-insert in a transaction.
  await db.transaction(async (tx) => {
    await tx
      .delete(lessonNotes)
      .where(
        and(
          eq(lessonNotes.lessonId, lessonId),
          eq(lessonNotes.studentId, studentId),
          eq(lessonNotes.tutorId, tutor.id),
        ),
      );
    await tx.insert(lessonNotes).values({
      lessonId,
      studentId,
      tutorId: tutor.id,
      ...data,
    });
  });

  revalidatePath(`/tutor/lessons/${lessonId}`);
  revalidatePath(`/tutor/students/${studentId}`);
  revalidatePath("/tutor/notes");
}

/**
 * Attach (or clear) a recording link for a lesson - a hosted video URL
 * (YouTube/Vimeo/Drive/etc.) that the class's students watch from their
 * "Recorded lessons" tab. Link-based, so there is no upload/storage cost.
 * Empty input clears the link; a non-empty value must be an http(s) URL.
 */
export async function saveLessonRecording(formData: FormData) {
  const tutor = await requireTutor();
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) throw new Error("Missing lessonId");
  await assertOwnsLesson(tutor.id, lessonId);

  const raw = String(formData.get("recordingUrl") ?? "").trim();
  let recordingUrl: string | null = null;
  if (raw) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("Enter a valid link starting with https://");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Enter a valid link starting with https://");
    }
    recordingUrl = raw.slice(0, 2000);
  }

  await db
    .update(lessons)
    .set({ recordingUrl })
    .where(eq(lessons.id, lessonId));

  revalidatePath(`/tutor/lessons/${lessonId}`);
  revalidatePath("/student/resources");
}

/**
 * Update a class's forward-looking lesson plan ("what's coming up"). Visible to
 * the class's students and their parents. Tutor must own the class. Empty text
 * clears the plan.
 */
export async function updateLessonPlan(input: {
  classId: string;
  plan: string;
}) {
  const tutor = await requireTutor();
  const classId = String(input.classId ?? "");
  if (!classId) return { ok: false as const, error: "Missing class" };
  await assertOwnsClass(tutor.id, classId);
  const plan = String(input.plan ?? "").trim().slice(0, 4000);
  await db
    .update(classes)
    .set({ lessonPlan: plan.length > 0 ? plan : null })
    .where(eq(classes.id, classId));
  revalidatePath(`/tutor/classes/${classId}`);
  return { ok: true as const };
}

/** Submit a class announcement for admin review. Nothing is delivered to the
 * class until an admin approves it from the notification inbox/announcement
 * page, so tutor-to-family communication always has the required checkpoint. */
export async function createClassAnnouncement(formData: FormData) {
  const tutor = await requireTutor();
  const classId = String(formData.get("classId") ?? "");
  if (!classId) throw new Error("Class required");

  const [cls] = await db
    .select({
      id: classes.id,
      name: classes.name,
      subjectName: subjects.name,
      tutorFirst: profiles.firstName,
      tutorLast: profiles.lastName,
    })
    .from(classes)
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .innerJoin(profiles, eq(profiles.id, classes.tutorId))
    .where(and(eq(classes.id, classId), eq(classes.tutorId, tutor.id)))
    .limit(1);
  if (!cls) throw new Error("Class not found");

  const title = requiredText(formData.get("title"), 200, "Title");
  const body = requiredText(formData.get("body"), 10000, "Message");
  const includeLinkedParents = formData.get("includeLinkedParents") === "on";
  const isUrgent = formData.get("isUrgent") === "on";

  const admins = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        inArray(profiles.role, [
          "admin",
          "admin_restricted",
          "admin_unrestricted",
        ]),
        eq(profiles.isActive, true),
      ),
    );

  await withActor({ id: tutor.id, role: "tutor" }, async (tx) => {
    const [announcement] = await tx
      .insert(announcements)
      .values({
        authorId: tutor.id,
        title,
        body,
        audienceClassId: classId,
        status: "pending",
        isUrgent,
        targetRoles: ["student"],
        targetClassIds: [classId],
        includeLinkedParents,
      })
      .returning({ id: announcements.id });
    if (admins.length) {
      const classLabel = classDisplayName(cls.subjectName, cls.name);
      await tx.insert(notifications).values(
        admins.map((admin) => ({
          userId: admin.id,
          channel: "in_app" as const,
          title: "Tutor announcement approval required",
          body: `${cls.tutorFirst} ${cls.tutorLast} submitted “${title}” for ${classLabel}${includeLinkedParents ? " and linked parents" : ""}${isUrgent ? " as urgent" : ""}.`,
          href: `/admin/announcements#announcement-${announcement.id}`,
          dedupeKey: `announcement-approval:${announcement.id}`,
        })),
      );
    }
  });

  revalidatePath(`/tutor/classes/${classId}`);
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  revalidatePath("/admin/announcements");
  revalidatePath("/admin/notifications");
}

/**
 * Delete a class announcement the tutor authored. Scoped to announcements
 * this tutor authored for a class they own; leaves the delivered
 * notifications in place (they are historical).
 */
export async function deleteClassAnnouncement(formData: FormData) {
  const tutor = await requireTutor();
  const announcementId = String(formData.get("announcementId") ?? "");
  const classId = String(formData.get("classId") ?? "");
  if (!announcementId || !classId) throw new Error("Missing announcement");

  await assertOwnsClass(tutor.id, classId);
  const [row] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(
      and(
        eq(announcements.id, announcementId),
        eq(announcements.authorId, tutor.id),
        eq(announcements.audienceClassId, classId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Announcement not found");

  await withActor({ id: tutor.id, role: "tutor" }, (tx) =>
    tx.delete(announcements).where(eq(announcements.id, announcementId)),
  );

  revalidatePath(`/tutor/classes/${classId}`);
}

export async function createHomework(formData: FormData) {
  const tutor = await requireTutor();
  const title = requiredText(formData.get("title"), 200, "Title");
  const description = optionalText(formData.get("description"), 5000);
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const classId = String(formData.get("classId") ?? "") || null;
  const weekId = String(formData.get("weekId") ?? "") || null;
  const allowResubmission = formData.get("allowResubmission") === "on";
  const isTest = formData.get("isTest") === "on";

  if (!dueDateRaw) throw new Error("Due date required");
  const dueDate = new Date(dueDateRaw);
  if (Number.isNaN(dueDate.getTime())) throw new Error("Invalid due date");

  let assignedStudentIds: string[] = [];
  if (classId) {
    await assertOwnsClass(tutor.id, classId);
    const rows = await db
      .select({ studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(eq(enrollments.classId, classId), isNull(enrollments.withdrawnAt)),
      );
    assignedStudentIds = rows.map((r) => r.studentId);
  }
  // Allow per-student assignment via "studentIds" multi-select
  const explicitIds = formData.getAll("studentIds").map(String).filter(Boolean);
  if (explicitIds.length) {
    for (const sid of explicitIds) {
      await assertTeachesStudent(tutor.id, sid);
    }
    assignedStudentIds = Array.from(
      new Set([...assignedStudentIds, ...explicitIds]),
    );
  }

  // The browser uploads the file directly to private Supabase Storage. This
  // action receives only the signed ticket, so Vercel's 4.5 MB request limit
  // never sees the PDF bytes.
  let attachmentUrl: string | null = null;
  const uploadTicket = String(formData.get("uploadTicket") ?? "");
  if (uploadTicket) {
    const verified = await finalizeDirectUpload({
      ticket: uploadTicket,
      expectedPurpose: TUTOR_HOMEWORK_UPLOAD_PURPOSE,
      expectedUserId: tutor.id,
      expectedScope: `${classId ?? ""}:${weekId ?? ""}`,
      policy: HOMEWORK_POLICY,
    });
    if (!verified.ok) throw new Error(verified.error);
    attachmentUrl = verified.value.path;
  }

  let created: { id: string };
  try {
    [created] = await db
      .insert(homework)
      .values({
        tutorId: tutor.id,
        classId,
        title,
        description: description || null,
        dueDate,
        attachmentUrl,
        allowResubmission,
        isTest,
        weekId,
      })
      .returning({ id: homework.id });
  } catch (error) {
    if (uploadTicket) await discardDirectUpload(uploadTicket);
    throw error;
  }

  if (assignedStudentIds.length) {
    await db
      .insert(homeworkAssignments)
      .values(
        assignedStudentIds.map((studentId) => ({
          homeworkId: created.id,
          studentId,
          status: "not_started" as const,
        })),
      )
      .onConflictDoNothing();
  }

  revalidatePath("/tutor/homework");
  revalidatePath("/tutor");
  if (classId) {
    revalidatePath(`/tutor/classes/${classId}/curriculum`);
  }
  return { ok: true as const, id: created.id };
}

export async function prepareTutorHomeworkAttachmentUpload(input: {
  classId: string;
  subjectWeekId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const tutor = await requireTutor();
  const parsed = directFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  await assertOwnsClass(tutor.id, parsed.data.classId);
  if (!(await tutorTeachesSubjectWeek(tutor.id, parsed.data.subjectWeekId))) {
    return { ok: false as const, error: "Not your subject" };
  }

  const validated = validateUploadMetadata(
    { size: parsed.data.sizeBytes, type: parsed.data.contentType },
    HOMEWORK_POLICY,
  );
  if (!validated.ok) return validated;
  return createDirectUploadGrant({
    purpose: TUTOR_HOMEWORK_UPLOAD_PURPOSE,
    userId: tutor.id,
    scope: `${parsed.data.classId}:${parsed.data.subjectWeekId}`,
    bucket: HOMEWORK_BUCKET,
    path: `${tutor.id}/${Date.now()}-${randomUUID()}.${validated.file.ext}`,
    fileName: parsed.data.fileName,
    sizeBytes: parsed.data.sizeBytes,
    contentType: parsed.data.contentType,
    policy: HOMEWORK_POLICY,
  });
}

export async function prepareTutorHomeworkEditAttachmentUpload(input: {
  homeworkId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const tutor = await requireTutor();
  const parsed = homeworkEditFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  await assertOwnsHomework(tutor.id, parsed.data.homeworkId);

  const validated = validateUploadMetadata(
    { size: parsed.data.sizeBytes, type: parsed.data.contentType },
    HOMEWORK_POLICY,
  );
  if (!validated.ok) return validated;
  return createDirectUploadGrant({
    purpose: TUTOR_HOMEWORK_EDIT_UPLOAD_PURPOSE,
    userId: tutor.id,
    scope: parsed.data.homeworkId,
    bucket: HOMEWORK_BUCKET,
    path: `${tutor.id}/${Date.now()}-${randomUUID()}.${validated.file.ext}`,
    fileName: parsed.data.fileName,
    sizeBytes: parsed.data.sizeBytes,
    contentType: parsed.data.contentType,
    policy: HOMEWORK_POLICY,
  });
}

/**
 * Edit an existing homework's own fields (title, description, due date,
 * resubmission/test flags, attachment). Student assignments are left
 * untouched - this only changes the task definition, so it is safe to run
 * after students have already submitted. Attachment can be replaced via a
 * browser-to-Storage upload or removed; the old object is deleted best-effort.
 */
export async function updateHomework(formData: FormData) {
  const tutor = await requireTutor();
  const homeworkId = String(formData.get("homeworkId") ?? "");
  if (!homeworkId) throw new Error("Homework required");

  const [existing] = await db
    .select()
    .from(homework)
    .where(and(eq(homework.id, homeworkId), eq(homework.tutorId, tutor.id)))
    .limit(1);
  if (!existing) throw new Error("Homework not found");

  const title = requiredText(formData.get("title"), 200, "Title");
  const description = optionalText(formData.get("description"), 5000);
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  if (!dueDateRaw) throw new Error("Due date required");
  const dueDate = new Date(dueDateRaw);
  if (Number.isNaN(dueDate.getTime())) throw new Error("Invalid due date");
  const allowResubmission = formData.get("allowResubmission") === "on";
  const isTest = formData.get("isTest") === "on";
  const removeAttachment = formData.get("removeAttachment") === "on";

  let attachmentUrl = existing.attachmentUrl;
  const oldPath = existing.attachmentUrl;
  const uploadTicket = String(formData.get("uploadTicket") ?? "");
  const hasNewFile = Boolean(uploadTicket);

  if (uploadTicket) {
    const verified = await finalizeDirectUpload({
      ticket: uploadTicket,
      expectedPurpose: TUTOR_HOMEWORK_EDIT_UPLOAD_PURPOSE,
      expectedUserId: tutor.id,
      expectedScope: homeworkId,
      policy: HOMEWORK_POLICY,
    });
    if (!verified.ok) throw new Error(verified.error);
    attachmentUrl = verified.value.path;
  } else if (removeAttachment) {
    attachmentUrl = null;
  }

  try {
    await db
      .update(homework)
      .set({
        title,
        description: description || null,
        dueDate,
        allowResubmission,
        isTest,
        attachmentUrl,
      })
      .where(eq(homework.id, homeworkId));
  } catch (error) {
    if (uploadTicket) await discardDirectUpload(uploadTicket);
    throw error;
  }

  // Best-effort cleanup only after the database points at the replacement.
  // The service client is required because this private bucket intentionally
  // has no broad storage.objects policy.
  if (
    (hasNewFile || removeAttachment) &&
    oldPath &&
    oldPath !== attachmentUrl &&
    !oldPath.startsWith("http")
  ) {
    try {
      await createAdminClient().storage.from(HOMEWORK_BUCKET).remove([oldPath]);
    } catch (err) {
      console.error("homework old attachment cleanup failed", err);
    }
  }

  revalidatePath(`/tutor/homework/${homeworkId}`);
  revalidatePath("/tutor/homework");
  revalidatePath("/tutor");
  redirect(`/tutor/homework/${homeworkId}`);
}

export async function markSubmission(formData: FormData) {
  const tutor = await requireTutor();
  const homeworkId = String(formData.get("homeworkId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const status = String(formData.get("status") ?? "marked");
  const scoreRaw = String(formData.get("score") ?? "").trim();
  const feedback = optionalText(formData.get("feedback"), 5000);

  if (!homeworkId || !studentId) throw new Error("Missing ids");
  await assertOwnsHomework(tutor.id, homeworkId);

  const parsedStatus = homeworkStatusSchema.safeParse(status);
  if (!parsedStatus.success) throw new Error("Invalid status");

  const update: Record<string, unknown> = {
    status: parsedStatus.data,
    feedback: feedback || null,
    markedAt: new Date(),
    markedBy: tutor.id,
  };
  if (scoreRaw) {
    const n = Number(scoreRaw);
    if (Number.isFinite(n)) update.score = String(n);
  } else {
    update.score = null;
  }

  await db
    .update(homeworkAssignments)
    .set(update)
    .where(
      and(
        eq(homeworkAssignments.homeworkId, homeworkId),
        eq(homeworkAssignments.studentId, studentId),
      ),
    );

  revalidatePath(`/tutor/homework/${homeworkId}`);
  revalidatePath("/tutor");
}

const weekdaySchema = z.coerce.number().int().min(0).max(6);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Day isolation sentinel: a `tutor_availability` row with
 * start_time='00:00:00', end_time='23:59:59', is_available=false flags the
 * date as detached from the recurring weekly rules. `expandAvailability`
 * suppresses weekly rules for that (tutor, date) pair; the day's actual
 * availability is then driven solely by positive per-date rows. The UI calls
 * this a one-date change; tutors do not need to understand the sentinel.
 */
const DAY_ISO_START = "00:00:00";
const DAY_ISO_END = "23:59:59";

type AvailabilityActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const hourTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):00$/, "Choose a whole-hour time");
const availabilityWindowSchema = z.object({
  startTime: hourTimeSchema,
  endTime: hourTimeSchema,
});

function hourlyWindows(startTime: string, endTime: string) {
  const start = Number(startTime.slice(0, 2));
  const end = Number(endTime.slice(0, 2));
  if (end <= start) return [];
  return Array.from({ length: end - start }, (_, index) => {
    const hour = start + index;
    return {
      startTime: `${String(hour).padStart(2, "0")}:00`,
      endTime: `${String(hour + 1).padStart(2, "0")}:00`,
    };
  });
}

function parseDate(value: FormDataEntryValue | null) {
  const parsed = isoDateSchema.safeParse(value);
  if (!parsed.success) return null;
  const instant = new Date(`${parsed.data}T00:00:00.000Z`);
  if (
    Number.isNaN(instant.getTime()) ||
    instant.toISOString().slice(0, 10) !== parsed.data
  ) {
    return null;
  }
  return parsed.data;
}

/** Add a readable recurring window while retaining hourly booking slots. */
export async function addRecurringAvailability(
  formData: FormData,
): Promise<AvailabilityActionResult> {
  const tutor = await requireTutor();
  const parsed = z
    .object({
      weekday: weekdaySchema,
      startTime: hourTimeSchema,
      endTime: hourTimeSchema,
    })
    .safeParse({
      weekday: formData.get("weekday"),
      startTime: formData.get("startTime"),
      endTime: formData.get("endTime"),
    });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid hours." };
  }
  const windows = hourlyWindows(parsed.data.startTime, parsed.data.endTime);
  if (windows.length === 0) {
    return { ok: false, error: "The finish time must be after the start time." };
  }

  const added = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`availability:${tutor.id}:weekday:${parsed.data.weekday}`}))`,
    );
    const existing = await tx
      .select({
        startTime: tutorAvailability.startTime,
        endTime: tutorAvailability.endTime,
      })
      .from(tutorAvailability)
      .where(
        and(
          eq(tutorAvailability.tutorId, tutor.id),
          eq(tutorAvailability.weekday, parsed.data.weekday),
          isNull(tutorAvailability.date),
          eq(tutorAvailability.isAvailable, true),
        ),
      );
    const missing = windows.filter(
      (window) =>
        !existing.some(
          (row) =>
            row.startTime.slice(0, 5) <= window.startTime &&
            row.endTime.slice(0, 5) >= window.endTime,
        ),
    );
    if (missing.length) {
      await tx.insert(tutorAvailability).values(
        missing.map((window) => ({
          tutorId: tutor.id,
          weekday: parsed.data.weekday,
          startTime: window.startTime,
          endTime: window.endTime,
          isAvailable: true,
        })),
      );
    }
    return missing.length;
  });

  revalidatePath("/tutor/timetable");
  return {
    ok: true,
    message: added ? "Recurring availability added." : "Those hours are already available.",
  };
}

export async function removeRecurringAvailability(
  formData: FormData,
): Promise<AvailabilityActionResult> {
  const tutor = await requireTutor();
  const parsed = z.array(z.string().uuid()).min(1).safeParse(formData.getAll("ruleId"));
  if (!parsed.success) return { ok: false, error: "Availability window not found." };
  await db
    .delete(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, tutor.id),
        inArray(tutorAvailability.id, parsed.data),
        isNull(tutorAvailability.date),
      ),
    );
  revalidatePath("/tutor/timetable");
  return { ok: true, message: "Recurring hours removed." };
}

export async function setDateUnavailable(
  formData: FormData,
): Promise<AvailabilityActionResult> {
  const tutor = await requireTutor();
  const date = parseDate(formData.get("date"));
  if (!date) return { ok: false, error: "Choose a valid date." };
  if (date < melbourneDate()) {
    return { ok: false, error: "A past date cannot be changed." };
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`availability:${tutor.id}:date:${date}`}))`,
    );
    await tx
      .delete(tutorAvailability)
      .where(
        and(eq(tutorAvailability.tutorId, tutor.id), eq(tutorAvailability.date, date)),
      );
    await tx.insert(tutorAvailability).values({
      tutorId: tutor.id,
      date,
      startTime: DAY_ISO_START,
      endTime: DAY_ISO_END,
      isAvailable: false,
    });
  });
  revalidatePath("/tutor/timetable");
  return { ok: true, message: "You are marked unavailable for that date." };
}

export async function setDateCustomAvailability(
  formData: FormData,
): Promise<AvailabilityActionResult> {
  const tutor = await requireTutor();
  const date = parseDate(formData.get("date"));
  const window = availabilityWindowSchema.safeParse({
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });
  if (!date) return { ok: false, error: "Choose a valid date." };
  if (date < melbourneDate()) {
    return { ok: false, error: "A past date cannot be changed." };
  }
  if (!window.success) {
    return { ok: false, error: window.error.issues[0]?.message ?? "Invalid hours." };
  }
  const windows = hourlyWindows(window.data.startTime, window.data.endTime);
  if (windows.length === 0) {
    return { ok: false, error: "The finish time must be after the start time." };
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`availability:${tutor.id}:date:${date}`}))`,
    );
    await tx
      .delete(tutorAvailability)
      .where(
        and(eq(tutorAvailability.tutorId, tutor.id), eq(tutorAvailability.date, date)),
      );
    await tx.insert(tutorAvailability).values([
      {
        tutorId: tutor.id,
        date,
        startTime: DAY_ISO_START,
        endTime: DAY_ISO_END,
        isAvailable: false,
      },
      ...windows.map((slot) => ({
        tutorId: tutor.id,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: true,
      })),
    ]);
  });
  revalidatePath("/tutor/timetable");
  return { ok: true, message: "Custom hours saved for that date." };
}

export async function restoreRecurringAvailability(
  formData: FormData,
): Promise<AvailabilityActionResult> {
  const tutor = await requireTutor();
  const date = parseDate(formData.get("date"));
  if (!date) return { ok: false, error: "Date change not found." };
  await db
    .delete(tutorAvailability)
    .where(
      and(eq(tutorAvailability.tutorId, tutor.id), eq(tutorAvailability.date, date)),
    );
  revalidatePath("/tutor/timetable");
  return { ok: true, message: "This date now follows your weekly hours again." };
}

// --- Tutor week section note + attachments ----------------------------------

async function tutorTeachesSubjectWeek(tutorId: string, subjectWeekId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: classes.id })
    .from(subjectWeeks)
    .innerJoin(
      classes,
      and(eq(classes.subjectId, subjectWeeks.subjectId), eq(classes.tutorId, tutorId)),
    )
    .where(eq(subjectWeeks.id, subjectWeekId))
    .limit(1);
  return Boolean(row);
}

async function ensureTutorSection(tutorId: string, subjectWeekId: string): Promise<string> {
  const [existing] = await db
    .select({ id: tutorWeekSections.id })
    .from(tutorWeekSections)
    .where(and(eq(tutorWeekSections.tutorId, tutorId), eq(tutorWeekSections.subjectWeekId, subjectWeekId)))
    .limit(1);
  if (existing) return existing.id;
  const [row] = await db
    .insert(tutorWeekSections)
    .values({ tutorId, subjectWeekId })
    .returning({ id: tutorWeekSections.id });
  return row.id;
}

const tutorNoteSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
  note: z.string().max(5000).optional(),
});

export async function upsertTutorWeekNote(formData: FormData) {
  const user = await requireRole("tutor");
  const parsed = tutorNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  if (!(await tutorTeachesSubjectWeek(user.id, parsed.data.subjectWeekId))) {
    return { ok: false as const, error: "Not your subject" };
  }
  const note = parsed.data.note?.trim() || null;
  await db
    .insert(tutorWeekSections)
    .values({ tutorId: user.id, subjectWeekId: parsed.data.subjectWeekId, note })
    .onConflictDoUpdate({
      target: [tutorWeekSections.tutorId, tutorWeekSections.subjectWeekId],
      set: { note, updatedAt: new Date() },
    });
  revalidatePath(`/tutor/classes/${parsed.data.classId}/curriculum`);
  return { ok: true as const };
}

const attachmentMetaSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
});

const TUTOR_WEEK_UPLOAD_PURPOSE = "tutor-week-attachment";

/**
 * Return a one-file Supabase upload token after checking that this tutor owns
 * the selected subject week. The PDF itself travels browser -> Supabase, not
 * through the Vercel Server Action request body.
 */
export async function prepareTutorWeekAttachmentUpload(input: {
  classId: string;
  subjectWeekId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const user = await requireRole("tutor");
  const parsed = directFileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  await assertOwnsClass(user.id, parsed.data.classId);
  if (!(await tutorTeachesSubjectWeek(user.id, parsed.data.subjectWeekId))) {
    return { ok: false as const, error: "Not your subject" };
  }

  const sectionId = await ensureTutorSection(user.id, parsed.data.subjectWeekId);
  const validated = validateUploadMetadata(
    { size: parsed.data.sizeBytes, type: parsed.data.contentType },
    ATTACHMENT_POLICY,
  );
  if (!validated.ok) return validated;
  return createDirectUploadGrant({
    purpose: TUTOR_WEEK_UPLOAD_PURPOSE,
    userId: user.id,
    scope: parsed.data.subjectWeekId,
    bucket: BUCKET,
    path: `tutor-sections/${sectionId}/${randomUUID()}.${validated.file.ext}`,
    fileName: parsed.data.fileName,
    sizeBytes: parsed.data.sizeBytes,
    contentType: parsed.data.contentType,
    policy: ATTACHMENT_POLICY,
  });
}

export async function finalizeTutorWeekAttachmentUpload(input: {
  classId: string;
  subjectWeekId: string;
  ticket: string;
}) {
  const user = await requireRole("tutor");
  const parsed = attachmentMetaSchema
    .extend({ ticket: z.string().min(1).max(4096) })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  await assertOwnsClass(user.id, parsed.data.classId);
  if (!(await tutorTeachesSubjectWeek(user.id, parsed.data.subjectWeekId))) {
    return { ok: false as const, error: "Not your subject" };
  }

  const verified = await finalizeDirectUpload({
    ticket: parsed.data.ticket,
    expectedPurpose: TUTOR_WEEK_UPLOAD_PURPOSE,
    expectedUserId: user.id,
    expectedScope: parsed.data.subjectWeekId,
    policy: ATTACHMENT_POLICY,
  });
  if (!verified.ok) return verified;

  const sectionId = await ensureTutorSection(user.id, parsed.data.subjectWeekId);
  try {
    await db.insert(tutorWeekAttachments).values({
      sectionId,
      fileName: verified.value.fileName,
      storagePath: verified.value.path,
      contentType: verified.value.contentType,
      sizeBytes: verified.value.sizeBytes,
    });
  } catch (err) {
    await discardDirectUpload(parsed.data.ticket);
    return { ok: false as const, error: (err as Error).message };
  }
  revalidatePath(`/tutor/classes/${parsed.data.classId}/curriculum`);
  return { ok: true as const };
}

export async function removeTutorWeekAttachment(attachmentId: string, classId: string) {
  const user = await requireRole("tutor");
  const inputParsed = z.object({ attachmentId: z.string().uuid(), classId: z.string().uuid() }).safeParse({ attachmentId, classId });
  if (!inputParsed.success) return { ok: false as const, error: inputParsed.error.message };
  const [row] = await db
    .select({ path: tutorWeekAttachments.storagePath, tutorId: tutorWeekSections.tutorId })
    .from(tutorWeekAttachments)
    .innerJoin(tutorWeekSections, eq(tutorWeekSections.id, tutorWeekAttachments.sectionId))
    .where(eq(tutorWeekAttachments.id, attachmentId))
    .limit(1);
  if (!row || row.tutorId !== user.id) return { ok: false as const, error: "Not found" };
  const [promoted] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.sourceAttachmentId, attachmentId), isNull(resources.removedAt)))
    .limit(1);
  if (promoted) {
    return {
      ok: false as const,
      error: "This file is published to the subject resource library. Remove it from the library first.",
    };
  }
  // Links have no storage object; only files need the bucket cleanup.
  if (row.path) await removeCurriculumObject(row.path);
  await db.delete(tutorWeekAttachments).where(eq(tutorWeekAttachments.id, attachmentId));
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const };
}

const tutorLinkSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  // Restrict to http(s): z.url() alone accepts javascript:/data: URLs, which
  // become stored XSS when rendered into an <a href> students/parents click.
  url: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((u) => {
      try {
        const p = new URL(u).protocol;
        return p === "http:" || p === "https:";
      } catch {
        return false;
      }
    }, "Only http(s) links are allowed"),
});

export async function addTutorWeekLink(formData: FormData) {
  const user = await requireRole("tutor");
  const parsed = tutorLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  if (!(await tutorTeachesSubjectWeek(user.id, parsed.data.subjectWeekId))) {
    return { ok: false as const, error: "Not your subject" };
  }
  const sectionId = await ensureTutorSection(user.id, parsed.data.subjectWeekId);
  await db.insert(tutorWeekAttachments).values({
    sectionId,
    kind: "link",
    fileName: parsed.data.label,
    url: parsed.data.url,
  });
  revalidatePath(`/tutor/classes/${parsed.data.classId}/curriculum`);
  return { ok: true as const };
}
