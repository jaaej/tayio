/*
 * Pure rules for the tutor's student profile (/tutor/students/[id]):
 * attendance and homework summaries and the URL contract. Unit-tested on
 * its own.
 */

export type FlagTone = "bad" | "warn" | "info" | "good";

/** The params carried on every tab link: `class` is the roster the profile
 *  was opened from, so its back button keeps returning there. */
export const LIST_PARAM_KEYS = ["class"] as const;

/** How many recent marked lessons the attendance figure looks back over. */
export const RECENT_LESSONS = 8;

// The attendance and homework rules are shared by every role.
export { attendanceSummary, type AttendanceSummary } from "@/lib/attendance-rules";
export { homeworkState, type HomeworkState } from "@/lib/homework-rules";
import { HOMEWORK_STATE_LABEL, type HomeworkState } from "@/lib/homework-rules";

export const HOMEWORK_STATE: Record<HomeworkState, { label: string; tone: FlagTone | "default" }> = {
  marked: { label: HOMEWORK_STATE_LABEL.marked, tone: "good" },
  to_mark: { label: HOMEWORK_STATE_LABEL.to_mark, tone: "warn" },
  overdue: { label: HOMEWORK_STATE_LABEL.overdue, tone: "bad" },
  due_today: { label: HOMEWORK_STATE_LABEL.due_today, tone: "warn" },
  open: { label: HOMEWORK_STATE_LABEL.open, tone: "default" },
};

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

/** `path` plus the list params of `source`, then any extra params. */
export function withListQuery(
  path: string,
  source: ParamSource,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const key of LIST_PARAM_KEYS) {
    const value = readParam(source, key);
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

type TimelineLesson = {
  lessonId: string;
  lessonDate: string;
  className: string;
  /** The tutor who teaches the lesson (`lessons.tutor_id`). */
  lessonTutorId: string;
};

export type TimelineMark = TimelineLesson & {
  status: string;
  moved: boolean | null;
  /** The roll note (staff only). */
  note: string | null;
};

export type TimelineNote<N> = TimelineLesson & { authorId: string; note: N };

export type LessonTimelineEntry<N> = {
  lessonId: string;
  date: string;
  className: string;
  mark: { status: string; moved: boolean | null; note: string | null } | null;
  notes: N[];
  /** The viewer teaches this lesson, so its page (roll and notes) opens. */
  canEdit: boolean;
  /** The viewer has written a note on it. */
  hasOwnNote: boolean;
};

/**
 * One entry per lesson, newest first: its attendance mark and roll note and
 * every note written on it, so the profile reads as one history instead of
 * an attendance list beside a notes list.
 */
export function lessonTimeline<N>(
  marks: readonly TimelineMark[],
  notes: readonly TimelineNote<N>[],
  viewerId: string,
): LessonTimelineEntry<N>[] {
  const entries = new Map<string, LessonTimelineEntry<N>>();
  const entryFor = (lesson: TimelineLesson) => {
    let entry = entries.get(lesson.lessonId);
    if (!entry) {
      entry = {
        lessonId: lesson.lessonId,
        date: lesson.lessonDate,
        className: lesson.className,
        mark: null,
        notes: [],
        canEdit: lesson.lessonTutorId === viewerId,
        hasOwnNote: false,
      };
      entries.set(lesson.lessonId, entry);
    }
    return entry;
  };
  for (const mark of marks) {
    entryFor(mark).mark = { status: mark.status, moved: mark.moved, note: mark.note };
  }
  for (const row of notes) {
    const entry = entryFor(row);
    entry.notes.push(row.note);
    if (row.authorId === viewerId) entry.hasOwnNote = true;
  }
  return [...entries.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className),
  );
}
