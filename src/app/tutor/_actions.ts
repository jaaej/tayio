"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  attendance,
  attendanceStatusEnum,
  classes,
  classWeekOverrides,
  enrollments,
  homework,
  homeworkAssignments,
  homeworkStatusEnum,
  lessonNotes,
  lessons,
  tutorAvailability,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { uploadCurriculumFile } from "@/lib/curriculum-storage";
import { requireTutor } from "./_data";

const HOMEWORK_BUCKET = "homework-attachments";

const attendanceStatusSchema = z.enum(attendanceStatusEnum.enumValues);
const homeworkStatusSchema = z.enum(homeworkStatusEnum.enumValues);

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
      ),
    )
    .limit(1);
  if (!row) throw new Error("Not authorised");
}

export async function saveAttendance(formData: FormData) {
  const tutor = await requireTutor();
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) throw new Error("Missing lessonId");
  await assertOwnsLesson(tutor.id, lessonId);

  // Iterate each "status[<studentId>]" pair
  const entries: { studentId: string; status: string; note: string }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^status\[(.+)\]$/);
    if (!match) continue;
    const studentId = match[1];
    const status = String(value ?? "");
    if (!status) continue;
    const note = String(formData.get(`note[${studentId}]`) ?? "");
    entries.push({ studentId, status, note });
  }

  for (const entry of entries) {
    const parsed = attendanceStatusSchema.safeParse(entry.status);
    if (!parsed.success) continue;
    await assertTeachesStudent(tutor.id, entry.studentId);
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
  await assertTeachesStudent(tutor.id, studentId);

  const data = {
    topicCovered: String(formData.get("topicCovered") ?? "") || null,
    performance: String(formData.get("performance") ?? "") || null,
    strengths: String(formData.get("strengths") ?? "") || null,
    struggles: String(formData.get("struggles") ?? "") || null,
    nextLessonFocus: String(formData.get("nextLessonFocus") ?? "") || null,
    parentVisibleComment:
      String(formData.get("parentVisibleComment") ?? "") || null,
    internalNote: String(formData.get("internalNote") ?? "") || null,
  };

  // Upsert by (lessonId, studentId, tutorId) — schema has no unique on those,
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

export async function createHomework(formData: FormData) {
  const tutor = await requireTutor();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const classId = String(formData.get("classId") ?? "") || null;
  const weekId = String(formData.get("weekId") ?? "") || null;
  const allowResubmission = formData.get("allowResubmission") === "on";

  if (!title) throw new Error("Title required");
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

  // Upload attachment if present
  let attachmentUrl: string | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const supabase = await createClient();
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${tutor.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage
      .from(HOMEWORK_BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      // Soft-fail: persist homework without attachment, surface message on next page.
      console.error("homework upload failed", error.message);
    } else {
      const { data } = supabase.storage.from(HOMEWORK_BUCKET).getPublicUrl(path);
      attachmentUrl = data.publicUrl;
    }
  }

  const [created] = await db
    .insert(homework)
    .values({
      tutorId: tutor.id,
      classId,
      title,
      description: description || null,
      dueDate,
      attachmentUrl,
      allowResubmission,
      weekId,
    })
    .returning({ id: homework.id });

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
  redirect(`/tutor/homework/${created.id}`);
}

export async function markSubmission(formData: FormData) {
  const tutor = await requireTutor();
  const homeworkId = String(formData.get("homeworkId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const status = String(formData.get("status") ?? "marked");
  const scoreRaw = String(formData.get("score") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim();

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
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function toggleAvailabilityRule(formData: FormData) {
  const tutor = await requireTutor();
  const weekday = weekdaySchema.parse(formData.get("weekday"));
  const startTime = timeSchema.parse(formData.get("startTime"));
  const endTime = timeSchema.parse(formData.get("endTime"));

  const existing = await db
    .select({ id: tutorAvailability.id })
    .from(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, tutor.id),
        eq(tutorAvailability.weekday, weekday),
        eq(tutorAvailability.startTime, startTime),
        eq(tutorAvailability.endTime, endTime),
        isNull(tutorAvailability.date),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(tutorAvailability)
      .where(eq(tutorAvailability.id, existing[0].id));
  } else {
    await db.insert(tutorAvailability).values({
      tutorId: tutor.id,
      weekday,
      startTime,
      endTime,
      isAvailable: true,
    });
  }

  revalidatePath("/tutor/timetable");
}

/**
 * Day isolation sentinel: a `tutor_availability` row with
 * start_time='00:00:00', end_time='23:59:59', is_available=false flags the
 * date as detached from the recurring weekly rules. `expandAvailability`
 * suppresses weekly rules for that (tutor, date) pair; the day's actual
 * availability is then driven solely by per-date override rows
 * (toggleDateOverride). Toggling off re-attaches the weekly rules.
 */
const DAY_ISO_START = "00:00:00";
const DAY_ISO_END = "23:59:59";

export async function toggleDayIsolation(formData: FormData) {
  const tutor = await requireTutor();
  const date = isoDateSchema.parse(formData.get("date"));

  const existing = await db
    .select({ id: tutorAvailability.id })
    .from(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, tutor.id),
        eq(tutorAvailability.date, date),
        eq(tutorAvailability.startTime, DAY_ISO_START),
        eq(tutorAvailability.endTime, DAY_ISO_END),
        eq(tutorAvailability.isAvailable, false),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // Un-isolate: drop the sentinel AND any positive date overrides for this
    // date (they were specific to the isolated picker — leaving them around
    // would silently expand availability once the weekly rules reapply).
    await db
      .delete(tutorAvailability)
      .where(eq(tutorAvailability.id, existing[0].id));
    await db
      .delete(tutorAvailability)
      .where(
        and(
          eq(tutorAvailability.tutorId, tutor.id),
          eq(tutorAvailability.date, date),
          eq(tutorAvailability.isAvailable, true),
        ),
      );
  } else {
    await db.insert(tutorAvailability).values({
      tutorId: tutor.id,
      date,
      startTime: DAY_ISO_START,
      endTime: DAY_ISO_END,
      isAvailable: false,
    });
  }

  revalidatePath("/tutor/timetable");
}

export async function toggleDateOverride(formData: FormData) {
  const tutor = await requireTutor();
  const date = isoDateSchema.parse(formData.get("date"));
  const startTime = timeSchema.parse(formData.get("startTime"));
  const endTime = timeSchema.parse(formData.get("endTime"));
  const setUnavailable = formData.get("setUnavailable") === "1";

  const existing = await db
    .select({ id: tutorAvailability.id, isAvailable: tutorAvailability.isAvailable })
    .from(tutorAvailability)
    .where(
      and(
        eq(tutorAvailability.tutorId, tutor.id),
        eq(tutorAvailability.date, date),
        eq(tutorAvailability.startTime, startTime),
        eq(tutorAvailability.endTime, endTime),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(tutorAvailability)
      .where(eq(tutorAvailability.id, existing[0].id));
  } else {
    await db.insert(tutorAvailability).values({
      tutorId: tutor.id,
      date,
      startTime,
      endTime,
      isAvailable: !setUnavailable,
    });
  }

  revalidatePath("/tutor/timetable");
}

// --- Curriculum overrides -----------------------------------------------

const overrideSchema = z.object({
  classId: z.string().uuid(),
  subjectWeekId: z.string().uuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  bookletUrl: z.string().optional(),
});

async function assertTutorOwnsClass(tutorId: string, classId: string) {
  const [row] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.tutorId, tutorId)))
    .limit(1);
  return Boolean(row);
}

function isEmptyOverride(o: {
  title: string | null;
  description: string | null;
  videoUrl: string | null;
  bookletUrl: string | null;
}) {
  return !o.title && !o.description && !o.videoUrl && !o.bookletUrl;
}

export async function upsertClassWeekOverride(formData: FormData) {
  const user = await requireRole("tutor");
  const parsed = overrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  if (!(await assertTutorOwnsClass(user.id, parsed.data.classId))) {
    return { ok: false as const, error: "Not your class" };
  }

  const { classId, subjectWeekId, ...fields } = parsed.data;
  const normalized = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v === "" || v === undefined ? null : v]),
  ) as {
    title: string | null;
    description: string | null;
    videoUrl: string | null;
    bookletUrl: string | null;
  };

  if (isEmptyOverride(normalized)) {
    await db
      .delete(classWeekOverrides)
      .where(
        and(
          eq(classWeekOverrides.classId, classId),
          eq(classWeekOverrides.subjectWeekId, subjectWeekId),
        ),
      );
  } else {
    await db
      .insert(classWeekOverrides)
      .values({ classId, subjectWeekId, ...normalized })
      .onConflictDoUpdate({
        target: [
          classWeekOverrides.classId,
          classWeekOverrides.subjectWeekId,
        ],
        set: { ...normalized, updatedAt: new Date() },
      });
  }

  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const };
}

export async function resetClassWeekOverride(
  classId: string,
  subjectWeekId: string,
) {
  const user = await requireRole("tutor");
  if (!(await assertTutorOwnsClass(user.id, classId))) {
    return { ok: false as const, error: "Not your class" };
  }
  await db
    .delete(classWeekOverrides)
    .where(
      and(
        eq(classWeekOverrides.classId, classId),
        eq(classWeekOverrides.subjectWeekId, subjectWeekId),
      ),
    );
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const };
}

export async function uploadTutorOverrideVideo(
  classId: string,
  subjectWeekId: string,
  formData: FormData,
) {
  const user = await requireRole("tutor");
  if (!(await assertTutorOwnsClass(user.id, classId))) {
    return { ok: false as const, error: "Not your class" };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const ownerId = `${classId}-${subjectWeekId}`;
  const res = await uploadCurriculumFile("videos", ownerId, file);
  if (!res.ok) return res;

  await db
    .insert(classWeekOverrides)
    .values({ classId, subjectWeekId, videoUrl: res.path })
    .onConflictDoUpdate({
      target: [classWeekOverrides.classId, classWeekOverrides.subjectWeekId],
      set: { videoUrl: res.path, updatedAt: new Date() },
    });
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const, path: res.path };
}

export async function uploadTutorOverrideBooklet(
  classId: string,
  subjectWeekId: string,
  formData: FormData,
) {
  const user = await requireRole("tutor");
  if (!(await assertTutorOwnsClass(user.id, classId))) {
    return { ok: false as const, error: "Not your class" };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "No file" };

  const ownerId = `${classId}-${subjectWeekId}`;
  const res = await uploadCurriculumFile("booklets", ownerId, file);
  if (!res.ok) return res;

  await db
    .insert(classWeekOverrides)
    .values({ classId, subjectWeekId, bookletUrl: res.path })
    .onConflictDoUpdate({
      target: [classWeekOverrides.classId, classWeekOverrides.subjectWeekId],
      set: { bookletUrl: res.path, updatedAt: new Date() },
    });
  revalidatePath(`/tutor/classes/${classId}/curriculum`);
  return { ok: true as const, path: res.path };
}
