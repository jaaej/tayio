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
  enrollments,
  homework,
  homeworkAssignments,
  homeworkStatusEnum,
  lessonNotes,
  lessons,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
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
