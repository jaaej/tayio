import {
  attendanceLabel,
  attendanceSummary,
  isAttended,
  isMovedAbsence,
  type AttendanceSummary,
} from "@/lib/attendance-rules";
import { HOMEWORK_STATE_LABEL, homeworkState, type HomeworkState } from "@/lib/homework-rules";

/*
 * A student's history for staff: every lesson with its attendance, every
 * homework task with its state, and every staff note about them in one dated
 * timeline. Pure (the admin profile's loader feeds it rows), so the rules
 * are unit tested and the same shapes can serve any staff view.
 */

export type HistoryTone = "good" | "warn" | "bad" | "info" | "default";

export type LessonMark = {
  lessonId: string;
  /** YYYY-MM-DD, Melbourne. */
  date: string;
  startTime: string;
  className: string;
  /** Null when the lesson ran and nobody marked this student. */
  status: string | null;
  moved: boolean;
};

export type AttendanceHistoryRow = LessonMark & { label: string; tone: HistoryTone };

export function attendanceTone(mark: { status: string | null; moved: boolean }): HistoryTone {
  if (mark.status === null) return "warn";
  if (isMovedAbsence({ status: mark.status, moved: mark.moved })) return "default";
  if (mark.status === "absent") return "bad";
  if (mark.status === "late" || mark.status === "left_early") return "warn";
  if (mark.status === "makeup_attended") return "info";
  return isAttended(mark.status) ? "good" : "default";
}

/** Newest first, with the shared labels ("Moved" for a moved lesson). */
export function attendanceHistory(lessons: readonly LessonMark[]): {
  rows: AttendanceHistoryRow[];
  summary: AttendanceSummary;
} {
  const rows = [...lessons]
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
    .map((lesson) => ({
      ...lesson,
      label:
        lesson.status === null
          ? "Not marked"
          : attendanceLabel({ status: lesson.status, moved: lesson.moved }),
      tone: attendanceTone(lesson),
    }));
  const summary = attendanceSummary(
    lessons.flatMap((l) => (l.status === null ? [] : [{ status: l.status, moved: l.moved }])),
  );
  return { rows, summary };
}

export type HomeworkTask = {
  homeworkId: string;
  title: string;
  className: string | null;
  /** YYYY-MM-DD, Melbourne. */
  dueDate: string;
  status: string;
  score: string | null;
};

export type HomeworkHistoryRow = HomeworkTask & {
  state: HomeworkState;
  label: string;
  tone: HistoryTone;
};

const HOMEWORK_TONE: Record<HomeworkState, HistoryTone> = {
  marked: "good",
  to_mark: "warn",
  overdue: "bad",
  due_today: "warn",
  open: "default",
};

/** Latest due first, each in the shared homework state. */
export function homeworkHistory(
  tasks: readonly HomeworkTask[],
  today: string,
): HomeworkHistoryRow[] {
  return [...tasks]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || a.title.localeCompare(b.title))
    .map((task) => {
      const state = homeworkState(task.status, task.dueDate, today);
      return { ...task, state, label: HOMEWORK_STATE_LABEL[state], tone: HOMEWORK_TONE[state] };
    });
}

export type StaffNoteKind = "lesson" | "roll" | "leave" | "trial";

export type StaffNote = {
  key: string;
  kind: StaffNoteKind;
  /** YYYY-MM-DD the note is about (the lesson, or the start of the period). */
  date: string;
  /** What the note is attached to, e.g. "Year 9 Maths · Tom Tutor". */
  source: string;
  text: string;
};

export const STAFF_NOTE_LABEL: Record<StaffNoteKind, string> = {
  lesson: "Lesson note",
  roll: "Roll note",
  leave: "Leave",
  trial: "Free trial",
};

/**
 * Every staff note about the student, newest first. Empty notes are left
 * out; on the same date a lesson's notes read before a period's.
 */
export function staffNotesTimeline(input: {
  lessonNotes: readonly { lessonId: string; date: string; className: string; tutorName: string; text: string | null }[];
  rollNotes: readonly { lessonId: string; date: string; className: string; text: string | null }[];
  leave: readonly { id: string; startDate: string; endDate: string; note: string | null }[];
  trial: { startDate: string; endDate: string; note: string | null } | null;
  formatRange: (start: string, end: string) => string;
}): StaffNote[] {
  const notes: StaffNote[] = [];
  for (const n of input.lessonNotes) {
    const text = n.text?.trim();
    if (text) {
      notes.push({
        key: `lesson:${n.lessonId}`,
        kind: "lesson",
        date: n.date,
        source: `${n.className} · ${n.tutorName}`,
        text,
      });
    }
  }
  for (const n of input.rollNotes) {
    const text = n.text?.trim();
    if (text) {
      notes.push({ key: `roll:${n.lessonId}`, kind: "roll", date: n.date, source: n.className, text });
    }
  }
  for (const l of input.leave) {
    const text = l.note?.trim();
    if (text) {
      notes.push({
        key: `leave:${l.id}`,
        kind: "leave",
        date: l.startDate,
        source: input.formatRange(l.startDate, l.endDate),
        text,
      });
    }
  }
  const trialNote = input.trial?.note?.trim();
  if (input.trial && trialNote) {
    notes.push({
      key: "trial",
      kind: "trial",
      date: input.trial.startDate,
      source: input.formatRange(input.trial.startDate, input.trial.endDate),
      text: trialNote,
    });
  }
  const order: Record<StaffNoteKind, number> = { lesson: 0, roll: 1, leave: 2, trial: 3 };
  return notes.sort(
    (a, b) => b.date.localeCompare(a.date) || order[a.kind] - order[b.kind] || a.key.localeCompare(b.key),
  );
}
