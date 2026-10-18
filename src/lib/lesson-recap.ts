import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { attendance, classes, enrollments, lessonNotes, lessons, profiles, subjects } from "@/db/schema";
import { hasFamilyNote, type FamilyNote } from "@/lib/lesson-recap-rules";

/*
 * Lesson recaps for students and parents: one query shape for the student
 * recap page, the parent Feedback page, a subject's feedback, the parent
 * Overview and the timetable's recap links. Only the family fields are ever
 * selected (FAMILY_NOTE_COLUMNS); the tutor's internal note never leaves the
 * database here. The app reads with its own server connection, where the
 * lesson_notes_safe view (which filters on auth.uid()) does not apply, so
 * this column list is the guard.
 */

const FAMILY_NOTE_COLUMNS = {
  topicCovered: lessonNotes.topicCovered,
  performance: lessonNotes.performance,
  strengths: lessonNotes.strengths,
  struggles: lessonNotes.struggles,
  nextLessonFocus: lessonNotes.nextLessonFocus,
  parentVisibleComment: lessonNotes.parentVisibleComment,
};

/** The note has a family field filled in (`hasFamilyNote` in SQL). */
export const familyNoteWrittenSql = sql<boolean>`coalesce(
  nullif(trim(${lessonNotes.topicCovered}), ''),
  nullif(trim(${lessonNotes.performance}), ''),
  nullif(trim(${lessonNotes.strengths}), ''),
  nullif(trim(${lessonNotes.struggles}), ''),
  nullif(trim(${lessonNotes.nextLessonFocus}), ''),
  nullif(trim(${lessonNotes.parentVisibleComment}), '')
) is not null`;

export type FamilyRecap = {
  lessonId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: (typeof lessons.status.enumValues)[number];
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  /** Who wrote the note (a cover tutor, say), else the lesson's tutor. */
  tutorFirstName: string | null;
  tutorName: string;
  recordingUrl: string | null;
  /** Null when the tutor has not written anything for the family yet. */
  note: FamilyNote | null;
  notedAt: Date | null;
};

const lessonTutor = alias(profiles, "recap_lesson_tutor");
const noteTutor = alias(profiles, "recap_note_tutor");

const recapColumns = () => ({
  lessonId: lessons.id,
  date: lessons.date,
  startTime: lessons.startTime,
  endTime: lessons.endTime,
  status: lessons.status,
  classId: lessons.classId,
  className: classes.name,
  subjectId: classes.subjectId,
  subjectName: subjects.name,
  subjectColor: subjects.color,
  recordingUrl: lessons.recordingUrl,
  lessonTutorFirst: lessonTutor.firstName,
  lessonTutorLast: lessonTutor.lastName,
  noteTutorFirst: noteTutor.firstName,
  noteTutorLast: noteTutor.lastName,
  noteId: lessonNotes.id,
  notedAt: lessonNotes.createdAt,
  ...FAMILY_NOTE_COLUMNS,
});

function recapQuery(studentId: string) {
  return db
    .select(recapColumns())
    .from(lessons)
    .innerJoin(classes, eq(classes.id, lessons.classId))
    .innerJoin(subjects, eq(subjects.id, classes.subjectId))
    .leftJoin(lessonTutor, eq(lessonTutor.id, lessons.tutorId))
    .leftJoin(
      lessonNotes,
      and(eq(lessonNotes.lessonId, lessons.id), eq(lessonNotes.studentId, studentId)),
    )
    .leftJoin(noteTutor, eq(noteTutor.id, lessonNotes.tutorId));
}

type RecapRow = Awaited<ReturnType<typeof recapQuery>>[number];

function toRecap(r: RecapRow): FamilyRecap {
  const first = r.noteTutorFirst ?? r.lessonTutorFirst;
  const last = r.noteTutorFirst ? r.noteTutorLast : r.lessonTutorLast;
  const note: FamilyNote = {
    topicCovered: r.topicCovered,
    performance: r.performance,
    strengths: r.strengths,
    struggles: r.struggles,
    nextLessonFocus: r.nextLessonFocus,
    parentVisibleComment: r.parentVisibleComment,
  };
  const written = hasFamilyNote(note);
  return {
    lessonId: r.lessonId,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    status: r.status,
    classId: r.classId,
    className: r.className,
    subjectId: r.subjectId,
    subjectName: r.subjectName,
    subjectColor: r.subjectColor,
    tutorFirstName: first,
    tutorName: [first, last].filter(Boolean).join(" "),
    recordingUrl: r.recordingUrl,
    note: written ? note : null,
    notedAt: written ? r.notedAt : null,
  };
}

/**
 * The student's written recaps, newest lesson first: every note with a
 * family field filled. `classId` narrows to one class (a subject page).
 */
export async function getFamilyRecaps(
  studentId: string,
  opts: { classId?: string; subjectId?: string; limit?: number } = {},
): Promise<FamilyRecap[]> {
  const query = recapQuery(studentId)
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        familyNoteWrittenSql,
        opts.classId ? eq(lessons.classId, opts.classId) : undefined,
        opts.subjectId ? eq(classes.subjectId, opts.subjectId) : undefined,
      ),
    )
    .orderBy(desc(lessons.date), desc(lessons.startTime));
  const rows = opts.limit ? await query.limit(opts.limit) : await query;
  return rows.map(toRecap);
}

/**
 * One lesson's recap for the student, or null when the lesson is not theirs:
 * a class they are enrolled in, a lesson they were on the roll for (a
 * make-up), or one they have a note for. `note` is null until the tutor
 * writes something for the family.
 */
export async function getFamilyRecap(studentId: string, lessonId: string): Promise<FamilyRecap | null> {
  const [row] = await recapQuery(studentId).where(eq(lessons.id, lessonId)).limit(1);
  if (!row) return null;
  if (!row.noteId) {
    const [access] = await db
      .select({ ok: sql<number>`1` })
      .from(lessons)
      .where(
        and(
          eq(lessons.id, lessonId),
          sql`(exists (select 1 from ${enrollments} e where e.class_id = ${lessons.classId} and e.student_id = ${studentId})
            or exists (select 1 from ${attendance} a where a.lesson_id = ${lessons.id} and a.student_id = ${studentId}))`,
        ),
      )
      .limit(1);
    if (!access) return null;
  }
  return toRecap(row);
}

/** Which of these lessons have a recap for the student (timetable links). */
export async function recapLessonIds(studentId: string, lessonIds: readonly string[]): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();
  const rows = await db
    .select({ lessonId: lessonNotes.lessonId })
    .from(lessonNotes)
    .where(
      and(
        eq(lessonNotes.studentId, studentId),
        inArray(lessonNotes.lessonId, [...lessonIds]),
        familyNoteWrittenSql,
      ),
    );
  return new Set(rows.map((r) => r.lessonId));
}
