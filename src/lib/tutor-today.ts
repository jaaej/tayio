import { inclusiveDayCount, lessonStartInstant } from "@/lib/tutor-cover-rules";

// Pure rules behind the tutor Today page and the Classes next-class strip.
// Lesson dates and times are Melbourne wall time, so every comparison goes
// through lessonStartInstant rather than the server clock.

export type LessonTiming = {
  state: "upcoming" | "soon" | "now" | "done";
  label: string;
  tone: "warn" | "good" | "neutral";
};

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "In 40 min" style label for a lesson relative to `now`. */
export function lessonTiming(
  date: string,
  startTime: string,
  endTime: string,
  now: Date,
): LessonTiming {
  const start = lessonStartInstant(date, startTime).getTime();
  const end = lessonStartInstant(date, endTime).getTime();
  const t = now.getTime();
  if (t >= end) return { state: "done", label: "Finished", tone: "neutral" };
  if (t >= start) return { state: "now", label: "Now", tone: "good" };
  const minutes = Math.max(1, Math.ceil((start - t) / 60_000));
  if (minutes <= 60) {
    return { state: "soon", label: `In ${durationLabel(minutes)}`, tone: "warn" };
  }
  return { state: "upcoming", label: `In ${durationLabel(minutes)}`, tone: "neutral" };
}

/**
 * The lesson the header "Open today's lesson" button should open: the one in
 * progress, else the next to start, else the last one that finished (notes
 * are still to write). Null on a day with no lessons.
 */
export function pickTodaysLesson<
  T extends { date: string; startTime: string; endTime: string },
>(lessons: T[], now: Date): T | null {
  if (lessons.length === 0) return null;
  const sorted = [...lessons].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  const open = sorted.find(
    (l) => lessonStartInstant(l.date, l.endTime).getTime() > now.getTime(),
  );
  return open ?? sorted[sorted.length - 1];
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function isoDayDiff(fromIso: string, toIso: string) {
  return toIso >= fromIso
    ? inclusiveDayCount(fromIso, toIso) - 1
    : -(inclusiveDayCount(toIso, fromIso) - 1);
}

const WEEKDAY = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * A nearby date as the tutor would say it: "Today", "Tomorrow", "Yesterday",
 * a weekday within the week either side, else "5 Oct".
 */
export function nearDayLabel(iso: string, todayIso: string) {
  const diff = isoDayDiff(todayIso, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (Math.abs(diff) < 7) return WEEKDAY.format(at(iso));
  return DAY_MONTH.format(at(iso));
}

/** "Mon 5 Oct", "Mon 5 and Thu 8 Oct", "Mon 5, Tue 6 and Thu 8 Oct". */
export function lessonDatesLabel(isoDates: string[]) {
  const sorted = [...new Set(isoDates)].sort();
  if (sorted.length === 0) return "";
  const parts = sorted.map((iso, i) => {
    const next = sorted[i + 1];
    // Drop the month while the next date shares it, so it reads once.
    const shareMonth = next && next.slice(0, 7) === iso.slice(0, 7);
    if (!shareMonth) return `${WEEKDAY.format(at(iso))} ${DAY_MONTH.format(at(iso))}`;
    return `${WEEKDAY.format(at(iso))} ${Number(iso.slice(8))}`;
  });
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export type BumpSource = {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string | null;
  /** Melbourne date the homework was due. */
  dueIso: string;
};

export type BumpRow = {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string | null;
  overdueCount: number;
  oldestDays: number;
  reason: string;
  tone: "bad" | "warn";
};

/**
 * One row per student with overdue homework: how many pieces and how late the
 * oldest is. Worst first: a week or more late (or three pieces behind) is red.
 */
export function summariseBumps(rows: BumpSource[], todayIso: string): BumpRow[] {
  const byStudent = new Map<string, { row: BumpSource; count: number; oldest: string }>();
  for (const r of rows) {
    const cur = byStudent.get(r.studentId);
    if (!cur) {
      byStudent.set(r.studentId, { row: r, count: 1, oldest: r.dueIso });
    } else {
      cur.count += 1;
      if (r.dueIso < cur.oldest) {
        cur.oldest = r.dueIso;
        cur.row = r;
      }
    }
  }
  return [...byStudent.values()]
    .map(({ row, count, oldest }) => {
      const oldestDays = Math.max(1, isoDayDiff(oldest, todayIso));
      const late = `${oldestDays} ${oldestDays === 1 ? "day" : "days"} overdue`;
      return {
        studentId: row.studentId,
        firstName: row.firstName,
        lastName: row.lastName,
        className: row.className,
        overdueCount: count,
        oldestDays,
        // Short enough to stay on one line in the reason pill on a phone.
        reason: count === 1 ? late : `${count} overdue · ${oldestDays}d late`,
        tone: oldestDays >= 7 || count >= 3 ? ("bad" as const) : ("warn" as const),
      };
    })
    .sort(
      (a, b) =>
        b.oldestDays - a.oldestDays ||
        b.overdueCount - a.overdueCount ||
        a.lastName.localeCompare(b.lastName),
    );
}

const QUIZ_STATUS_PHRASE: Record<string, string> = {
  requested: "quiz requested",
  changes_requested: "quiz needs changes",
  pending_review: "quiz in review",
  approved: "quiz ready",
  admin: "quiz ready",
};

/**
 * The one-line state of a lesson's week, e.g. "Recording uploaded · quiz
 * needs changes · homework due Thu". Only facts the tutor can act on or rely
 * on; nothing is said about a missing recording before the lesson has ended.
 */
export function weekStatusLine(input: {
  hasRecording: boolean;
  lessonDone: boolean;
  quizStatus: string | null;
  /** Melbourne date of the week's earliest homework due date, if any. */
  homeworkDueIso: string | null;
  todayIso: string;
}): string {
  const parts: string[] = [];
  if (input.hasRecording) parts.push("recording uploaded");
  else if (input.lessonDone) parts.push("no recording yet");
  const quiz = input.quizStatus ? QUIZ_STATUS_PHRASE[input.quizStatus] : undefined;
  if (quiz) parts.push(quiz);
  if (input.homeworkDueIso) {
    const diff = isoDayDiff(input.todayIso, input.homeworkDueIso);
    if (diff < 0) parts.push("homework closed");
    else if (diff <= 1) parts.push(`homework due ${diff === 0 ? "today" : "tomorrow"}`);
    else parts.push(`homework due ${nearDayLabel(input.homeworkDueIso, input.todayIso)}`);
  } else {
    parts.push("no homework set");
  }
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

