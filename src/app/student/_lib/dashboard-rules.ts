/*
 * Pure rules behind the student dashboard: what the student should do next,
 * which subject is on now or next, and the day-by-day week. Dates are
 * Melbourne calendar days (YYYY-MM-DD); "now" is a real instant.
 */

import { formatScore, formatTime } from "@/lib/format";
import { isHandedIn, isMarked } from "@/lib/homework-rules";
import { addIsoDays } from "@/lib/tutor-checkin-rules";
import { lessonStartInstant } from "@/lib/tutor-cover-rules";

export type DashLesson = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
};

export type DashHomework = {
  homeworkId: string;
  title: string;
  /** Melbourne day the homework is due. */
  dueDay: string;
  status: string;
  score: string | null;
  markedAt: Date | null;
  subjectName: string | null;
  subjectColor: string | null;
};

export type DashWeekItem = {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  subjectWeekId: string;
  weekNumber: number;
  weekTitle: string;
  quiz: { id: string; title: string; questionCount: number } | null;
  quizDone: boolean;
  hasVideo: boolean;
  videoWatched: boolean;
};

export type StudentTodoKind =
  | "overdue"
  | "resubmit"
  | "due-soon"
  | "payment"
  | "quiz"
  | "video"
  | "due-later"
  | "marked";

export type StudentTodo = {
  key: string;
  kind: StudentTodoKind;
  title: string;
  detail: string;
  href: string;
  action: string;
  /** Subject the row belongs to, for its colour. */
  subjectName: string | null;
  subjectColor: string | null;
  /** How many things the row stands for (more than 1 for a summary row). */
  count: number;
  /** Due day of a homework row. */
  dueDay?: string;
};

const DROPPED_LESSON = new Set(["cancelled", "rescheduled"]);
const KIND_ORDER: StudentTodoKind[] = [
  "overdue",
  "resubmit",
  "due-soon",
  "payment",
  "quiz",
  "video",
  "due-later",
  "marked",
];
/** "Due soon" means today, tomorrow or the day after. */
const SOON_DAYS = 2;
/** More overdue items than this collapse into one summary row. */
const OVERDUE_ROWS = 2;
/** Marked work stays on the list for a week so the student sees the feedback. */
const MARKED_DAYS = 7;

const weekdayShort = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function utcDay(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utcDay(toIso).getTime() - utcDay(fromIso).getTime()) / 86_400_000);
}

/** "Year 9 Maths" -> "Maths", "VCE Maths Methods" -> "Maths Methods". */
export function shortSubject(name: string): string {
  const short = name
    .replace(/^(year|yr)\s*\d+\s+/i, "")
    .replace(/^vce\s+/i, "")
    .trim();
  return short || name;
}

/** A day relative to today: "today", "tomorrow", "Fri", or "Thu 22 Oct". */
export function relativeDay(dayIso: string, todayIso: string): string {
  const diff = daysBetween(todayIso, dayIso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff < 7) return weekdayShort.format(utcDay(dayIso));
  // en-AU writes "Thu, 22 Oct"; the comma is noise in a short label.
  return dayMonth.format(utcDay(dayIso)).replace(",", "");
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type LessonState = "live" | "upcoming" | "past";

export function lessonState(lesson: DashLesson, now: Date): LessonState {
  const start = lessonStartInstant(lesson.date, lesson.startTime).getTime();
  const end = lessonStartInstant(lesson.date, lesson.endTime).getTime();
  const t = now.getTime();
  if (t >= end) return "past";
  return t >= start ? "live" : "upcoming";
}

/** Each subject's lesson that is on now, or else its next one, by subject id. */
export function nextLessonBySubject(
  lessons: DashLesson[],
  now: Date,
): Map<string, DashLesson & { live: boolean }> {
  const next = new Map<string, DashLesson & { live: boolean }>();
  const ordered = [...lessons].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
  );
  for (const lesson of ordered) {
    if (DROPPED_LESSON.has(lesson.status) || next.has(lesson.subjectId)) continue;
    const state = lessonState(lesson, now);
    if (state === "past") continue;
    next.set(lesson.subjectId, { ...lesson, live: state === "live" });
  }
  return next;
}

/** The subject (id) on now, or else the one whose lesson comes soonest. */
export function featuredSubjectId(
  next: Map<string, DashLesson & { live: boolean }>,
): string | null {
  let best: (DashLesson & { live: boolean }) | null = null;
  for (const lesson of next.values()) {
    if (
      !best ||
      (lesson.live && !best.live) ||
      (lesson.live === best.live &&
        (lesson.date.localeCompare(best.date) || lesson.startTime.localeCompare(best.startTime)) < 0)
    ) {
      best = lesson;
    }
  }
  return best?.subjectId ?? null;
}

/** "On now until 5:30 pm", "Today 4 pm", "Next lesson Thu 4 pm". */
export function nextLessonLabel(
  lesson: (DashLesson & { live: boolean }) | undefined,
  todayIso: string,
): string {
  if (!lesson) return "No lessons booked";
  if (lesson.live) return `On now until ${formatTime(lesson.endTime)}`;
  const day = relativeDay(lesson.date, todayIso);
  if (day === "today" || day === "tomorrow") {
    return `${capitalise(day)} ${formatTime(lesson.startTime)}`;
  }
  return `Next lesson ${day} ${formatTime(lesson.startTime)}`;
}

function homeworkAction(status: string): string {
  if (status === "resubmission_requested") return "Resubmit";
  return status === "viewed" ? "Continue" : "Start";
}

/**
 * Everything waiting on the student, most urgent first: overdue work, work
 * sent back, work due in the next two days, an unpaid balance, this week's
 * quiz and video, later homework, then marks from the last week.
 */
export function buildStudentTodo(input: {
  homework: DashHomework[];
  weekItems: DashWeekItem[];
  outstanding: number | null;
  outstandingLabel?: string;
  todayIso: string;
  now: Date;
}): StudentTodo[] {
  const { todayIso, now } = input;
  const rows: Array<Omit<StudentTodo, "count"> & { sort: string }> = [];

  for (const hw of input.homework) {
    const subject = hw.subjectName ? shortSubject(hw.subjectName) : null;
    const href = `/student/homework/${hw.homeworkId}`;
    if (!isHandedIn(hw.status)) {
      const diff = daysBetween(todayIso, hw.dueDay);
      const resubmit = hw.status === "resubmission_requested";
      const kind: StudentTodoKind = resubmit
        ? "resubmit"
        : diff < 0
          ? "overdue"
          : diff <= SOON_DAYS
            ? "due-soon"
            : "due-later";
      const when =
        diff < 0
          ? `was due ${relativeDay(hw.dueDay, todayIso)}`
          : `due ${relativeDay(hw.dueDay, todayIso)}`;
      rows.push({
        key: `hw-${hw.homeworkId}`,
        kind,
        title: hw.title,
        detail: [subject, resubmit ? "sent back for changes" : when]
          .filter(Boolean)
          .join(" · "),
        href,
        action: homeworkAction(hw.status),
        subjectName: hw.subjectName,
        subjectColor: hw.subjectColor,
        dueDay: hw.dueDay,
        sort: hw.dueDay,
      });
      continue;
    }
    if (isMarked(hw.status) && hw.markedAt) {
      const ageDays = (now.getTime() - hw.markedAt.getTime()) / 86_400_000;
      if (ageDays < 0 || ageDays > MARKED_DAYS) continue;
      rows.push({
        key: `marked-${hw.homeworkId}`,
        kind: "marked",
        title: hw.title,
        detail: [subject, "feedback given", hw.score !== null ? formatScore(hw.score) : null]
          .filter(Boolean)
          .join(" · "),
        href,
        action: "See feedback",
        subjectName: hw.subjectName,
        subjectColor: hw.subjectColor,
        // Newest marks first.
        sort: String(9e15 - hw.markedAt.getTime()).padStart(16, "0"),
      });
    }
  }

  for (const week of input.weekItems) {
    const subject = shortSubject(week.subjectName);
    if (week.quiz && !week.quizDone) {
      rows.push({
        key: `quiz-${week.quiz.id}`,
        kind: "quiz",
        title: week.quiz.title,
        detail: `${subject} · Week ${week.weekNumber} · ${week.quiz.questionCount} ${
          week.quiz.questionCount === 1 ? "question" : "questions"
        }`,
        href: `/student/quizzes/${week.quiz.id}`,
        action: "Start quiz",
        subjectName: week.subjectName,
        subjectColor: week.subjectColor,
        sort: week.subjectName,
      });
    }
    if (week.hasVideo && !week.videoWatched) {
      rows.push({
        key: `video-${week.subjectWeekId}`,
        kind: "video",
        title: `Watch Week ${week.weekNumber}: ${week.weekTitle}`,
        detail: subject,
        href: `/student/subjects/${week.subjectId}?week=${week.subjectWeekId}`,
        action: "Watch",
        subjectName: week.subjectName,
        subjectColor: week.subjectColor,
        sort: week.subjectName,
      });
    }
  }

  if (input.outstanding !== null && input.outstanding > 0) {
    rows.push({
      key: "payment",
      kind: "payment",
      title: "Invoice to pay",
      detail: input.outstandingLabel ?? "",
      href: "/student/payments",
      action: "View invoices",
      subjectName: null,
      subjectColor: null,
      sort: "",
    });
  }

  const sorted = rows
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.sort.localeCompare(b.sort),
    )
    .map(({ sort: _sort, ...row }) => ({ ...row, count: 1 }));

  // A long tail of overdue work buries this week's tasks; past a couple it
  // becomes one row that sends the student to Homework to sort it out.
  const overdue = sorted.filter((row) => row.kind === "overdue");
  if (overdue.length <= OVERDUE_ROWS) return sorted;
  const summary: StudentTodo = {
    key: "overdue",
    kind: "overdue",
    title: `${overdue.length} overdue pieces of homework`,
    detail: `Oldest: ${overdue[0].title}`,
    href: "/student/homework",
    action: "Review",
    subjectName: null,
    subjectColor: null,
    count: overdue.length,
  };
  return [summary, ...sorted.filter((row) => row.kind !== "overdue")];
}

export type WeekDay = {
  iso: string;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  lessons: Array<{
    id: string;
    subjectName: string;
    subjectColor: string | null;
    label: string;
    live: boolean;
    /** Already finished, so shown faded. */
    past: boolean;
  }>;
  due: Array<{ homeworkId: string; title: string; subjectName: string | null }>;
};

/** Monday to Sunday of the week starting `weekStartIso`. */
export function buildWeekDays(input: {
  weekStartIso: string;
  todayIso: string;
  lessons: DashLesson[];
  homework: DashHomework[];
  now: Date;
}): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const iso = addIsoDays(input.weekStartIso, index);
    const lessons = input.lessons
      .filter((lesson) => lesson.date === iso && !DROPPED_LESSON.has(lesson.status))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((lesson) => {
        const state = lessonState(lesson, input.now);
        const live = state === "live";
        return {
          id: lesson.id,
          subjectName: lesson.subjectName,
          subjectColor: lesson.subjectColor,
          label: `${shortSubject(lesson.subjectName)} · ${
            live ? "on now" : formatTime(lesson.startTime)
          }`,
          live,
          past: state === "past",
        };
      });
    const due = input.homework
      .filter((hw) => hw.dueDay === iso && !isHandedIn(hw.status))
      .map((hw) => ({ homeworkId: hw.homeworkId, title: hw.title, subjectName: hw.subjectName }));
    return {
      iso,
      weekday: weekdayShort.format(utcDay(iso)),
      dayNumber: utcDay(iso).getUTCDate(),
      isToday: iso === input.todayIso,
      isPast: iso < input.todayIso,
      lessons,
      due,
    };
  });
}
