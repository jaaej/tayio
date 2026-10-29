import {
  attendanceLabel,
  attendanceRateTone,
  attendanceSummary,
  isAttended,
  isMovedAbsence,
} from "@/lib/attendance-rules";
import { formatDateShort } from "@/lib/format";
import { HOMEWORK_STATE_LABEL, homeworkState, isMarked, type HomeworkState } from "@/lib/homework-rules";
import { averageScore, scoreAverageBasis } from "@/lib/score-average";

/*
 * A student's record for staff, the same for an admin and a tutor (only the
 * rows each may see differ, see `getStudentRecord`): every lesson with its
 * attendance and notes, every homework task with its state, the four key
 * numbers, and the admin's other staff notes. Pure, so the rules are unit
 * tested.
 */

/** How many recent marked lessons the attendance figure looks back over. */
export const RECENT_LESSONS = 8;

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
  /** Taiyo cancelled the lesson (they had a class credit for it). */
  cancelled?: boolean;
};

export function attendanceTone(mark: { status: string | null; moved: boolean; cancelled?: boolean }): HistoryTone {
  if (mark.cancelled) return "default";
  if (mark.status === null) return "warn";
  if (isMovedAbsence({ status: mark.status, moved: mark.moved })) return "default";
  if (mark.status === "absent") return "bad";
  if (mark.status === "late" || mark.status === "left_early") return "warn";
  if (mark.status === "makeup_attended") return "info";
  return isAttended(mark.status) ? "good" : "default";
}

/** The shared labels: "Moved" for a moved lesson, "Cancelled by Taiyo", "Not marked". */
export function lessonLabel(mark: { status: string | null; moved: boolean; cancelled?: boolean }): string {
  if (mark.cancelled) return "Cancelled by Taiyo";
  if (mark.status === null) return "Not marked";
  return attendanceLabel({ status: mark.status, moved: mark.moved });
}

/** A lesson the student was on: their mark (if any), the roll note and who teaches it. */
export type HistoryLesson = LessonMark & {
  /** The roll note (staff only). */
  rollNote: string | null;
  /** The tutor who teaches the lesson (`lessons.tutor_id`). */
  tutorId: string;
};

export type LessonTimelineEntry<N> = HistoryLesson & {
  label: string;
  tone: HistoryTone;
  notes: N[];
};

/**
 * One entry per lesson, newest first: its attendance (or "Not marked"), the
 * roll note and every lesson note written on it, so the record reads as one
 * history instead of an attendance list beside a notes list. When a lesson
 * comes twice, its mark wins over a cancellation, and both over "not
 * marked". A note on a lesson with no record of the student still gets an
 * entry.
 */
export function lessonTimeline<N>(
  lessons: readonly HistoryLesson[],
  notes: readonly { lesson: Omit<HistoryLesson, "status" | "moved" | "cancelled" | "rollNote">; note: N }[],
): LessonTimelineEntry<N>[] {
  const rank = (l: HistoryLesson) => (l.status !== null ? 2 : l.cancelled ? 1 : 0);
  const byId = new Map<string, HistoryLesson>();
  for (const lesson of lessons) {
    const seen = byId.get(lesson.lessonId);
    if (!seen || rank(lesson) > rank(seen)) byId.set(lesson.lessonId, lesson);
  }
  const entries = new Map<string, LessonTimelineEntry<N>>();
  for (const lesson of byId.values()) {
    entries.set(lesson.lessonId, { ...lesson, label: lessonLabel(lesson), tone: attendanceTone(lesson), notes: [] });
  }
  for (const { lesson, note } of notes) {
    let entry = entries.get(lesson.lessonId);
    if (!entry) {
      const unmarked: HistoryLesson = { ...lesson, status: null, moved: false, rollNote: null };
      entry = { ...unmarked, label: lessonLabel(unmarked), tone: attendanceTone(unmarked), notes: [] };
      entries.set(lesson.lessonId, entry);
    }
    entry.notes.push(note);
  }
  return [...entries.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.startTime.localeCompare(a.startTime) ||
      a.className.localeCompare(b.className),
  );
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

export type HomeworkHistoryRow<T extends HomeworkTask = HomeworkTask> = T & {
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
export function homeworkHistory<T extends HomeworkTask>(
  tasks: readonly T[],
  today: string,
): HomeworkHistoryRow<T>[] {
  return [...tasks]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || a.title.localeCompare(b.title))
    .map((task) => {
      const state = homeworkState(task.status, task.dueDate, today);
      return { ...task, state, label: HOMEWORK_STATE_LABEL[state], tone: HOMEWORK_TONE[state] };
    });
}

export type KeyNumber = {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "warn" | "bad";
};

/**
 * The four numbers at the top of a student's record: attendance over their
 * last `RECENT_LESSONS` marked lessons, homework handed in of what is due so
 * far, the average score (marked homework and quizzes), and lesson notes.
 */
export function keyNumbers(input: {
  timeline: readonly LessonTimelineEntry<unknown>[];
  homework: readonly HomeworkHistoryRow[];
  quizAttempts: readonly { correctCount: number; total: number }[];
  /** The lesson date of each note the viewer can read. */
  noteDates: readonly string[];
  today: string;
}): KeyNumber[] {
  const recent = input.timeline
    .filter((e) => e.status !== null && !e.cancelled)
    .slice(0, RECENT_LESSONS)
    .map((e) => ({ status: e.status as string, moved: e.moved }));
  const att = attendanceSummary(recent);

  const dueSoFar = input.homework.filter((h) => h.dueDate <= input.today);
  const handedIn = dueSoFar.filter((h) => h.state === "marked" || h.state === "to_mark").length;
  const overdue = input.homework.filter((h) => h.state === "overdue").length;
  const toMark = input.homework.filter((h) => h.state === "to_mark").length;

  const avg = averageScore(
    input.homework.filter((h) => isMarked(h.status)).map((h) => h.score),
    [...input.quizAttempts],
  );

  const latestNote = input.noteDates.reduce<string | null>((max, d) => (max === null || d > max ? d : max), null);

  return [
    {
      label: "Attendance",
      value: att.percent === null ? "-" : `${att.percent}%`,
      sub: att.total === 0 ? "no lessons marked yet" : `${att.attended} of ${att.total} recent lessons`,
      tone: att.percent === null ? undefined : attendanceRateTone(att.percent),
    },
    {
      label: "Homework",
      value: dueSoFar.length === 0 ? "-" : `${handedIn} of ${dueSoFar.length}`,
      sub:
        [overdue > 0 ? `${overdue} overdue` : null, toMark > 0 ? `${toMark} to mark` : null]
          .filter(Boolean)
          .join(" · ") || (dueSoFar.length === 0 ? "nothing due yet" : "all handed in"),
      tone: overdue > 0 ? "bad" : undefined,
    },
    {
      label: "Average score",
      value: avg.percent === null ? "-" : `${avg.percent}%`,
      sub: avg.percent === null ? "nothing marked yet" : scoreAverageBasis(avg),
    },
    {
      label: "Lesson notes",
      value: String(input.noteDates.length),
      sub: latestNote ? `latest ${formatDateShort(latestNote)}` : "none yet",
    },
  ];
}

export type StaffNoteKind = "leave" | "trial";

export type StaffNote = {
  key: string;
  kind: StaffNoteKind;
  /** YYYY-MM-DD the note is about (the start of the period). */
  date: string;
  /** What the note is attached to, e.g. "1 July - 10 July". */
  source: string;
  text: string;
};

export const STAFF_NOTE_LABEL: Record<StaffNoteKind, string> = {
  leave: "Leave",
  trial: "Free trial",
};

/**
 * The admin's staff notes that belong to no lesson (lesson and roll notes
 * sit on their lesson in the timeline), newest first. Empty notes are left
 * out; on the same date leave reads before the trial.
 */
export function staffNotesTimeline(input: {
  leave: readonly { id: string; startDate: string; endDate: string; note: string | null }[];
  trial: { startDate: string; endDate: string; note: string | null } | null;
  formatRange: (start: string, end: string) => string;
}): StaffNote[] {
  const notes: StaffNote[] = [];
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
  const order: Record<StaffNoteKind, number> = { leave: 0, trial: 1 };
  return notes.sort(
    (a, b) => b.date.localeCompare(a.date) || order[a.kind] - order[b.kind] || a.key.localeCompare(b.key),
  );
}
