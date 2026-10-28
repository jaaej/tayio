/*
 * Pure rules for the tutor's student profile (/tutor/students/[id]):
 * attendance and homework summaries and the URL contract. Unit-tested on
 * its own.
 */

export type FlagTone = "bad" | "warn" | "info" | "good";

/** The params carried on every tab link, so the back button keeps
 *  returning to where the profile was opened from (`profileBack`). */
export const LIST_PARAM_KEYS = ["class", "from", "homework", "lesson", "view"] as const;

/** How many recent marked lessons the attendance figure looks back over. */
export const RECENT_LESSONS = 8;

// The attendance and homework rules are shared by every role.
export { attendanceSummary, type AttendanceSummary } from "@/lib/attendance-rules";
export { homeworkState, type HomeworkState } from "@/lib/homework-rules";
import { HOMEWORK_STATE_LABEL, type HomeworkState } from "@/lib/homework-rules";
import { parseMarkingView, submissionHref } from "@/app/tutor/homework/_lib/marking-list";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidParam = (source: ParamSource, key: string) => {
  const value = readParam(source, key);
  return value && UUID_RE.test(value) ? value : null;
};

/**
 * Where the profile's back button goes, from the params the opening link
 * set: a class roster (`class`), the submission being marked
 * (`from=marking&homework=`, with the Marking `view`), a lesson
 * (`from=lesson&lesson=`) or Today (`from=today`). Anything else, a search
 * or a message, goes to Classes, where the tutor's students live.
 */
export function profileBack(studentId: string, source: ParamSource): { href: string; label: string } {
  const from = readParam(source, "from");
  const classId = uuidParam(source, "class");
  const homeworkId = uuidParam(source, "homework");
  const lessonId = uuidParam(source, "lesson");
  if (classId) return { href: `/tutor/classes/${classId}/students`, label: "Back to class" };
  if (from === "marking" && homeworkId) {
    return {
      href: submissionHref(homeworkId, studentId, { view: parseMarkingView(readParam(source, "view")) }),
      label: "Back to marking",
    };
  }
  if (from === "lesson" && lessonId) return { href: `/tutor/lessons/${lessonId}`, label: "Back to lesson" };
  if (from === "today") return { href: "/tutor", label: "Back to Today" };
  return { href: "/tutor/classes", label: "Classes" };
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
