// Pure rules for a lesson's progress, shared by the tutor class Lessons tab,
// tutor Today, the lesson page and the admin dashboard: where each lesson goes (this week,
// needs finishing, done) and how its attendance reads. A lesson that ran is
// finished once its attendance is marked; lesson notes are optional (owner
// decision, 29 October 2026). Kept free of I/O so the grouping and date math
// are unit tested.

import { weekNumberOn } from "@/lib/week-plan-rules";

export type LessonCounts = {
  id: string;
  /** YYYY-MM-DD, Melbourne wall date. */
  date: string;
  /** HH:MM[:SS], Melbourne wall time. */
  startTime: string;
  endTime: string;
  status: string;
  /** Students on the lesson's roll (`lessonCountFields` in lesson-progress-sql). */
  roster: number;
  /** Students with any attendance row for the lesson. */
  marked: number;
  absent: number;
};

export type Tone = "good" | "warn" | "info" | "default";

export type LessonView = LessonCounts & {
  isToday: boolean;
  started: boolean;
  finished: boolean;
  attendanceLabel: string;
  attendanceTone: Tone;
  action: "open" | "attendance" | "view";
};

export type LessonGroups = {
  thisWeek: LessonView[];
  needsFinishing: LessonView[];
  done: LessonView[];
};

const OFF_STATUSES = new Set(["cancelled", "rescheduled"]);

/** Monday (YYYY-MM-DD) of the week containing `isoDate`. */
export function mondayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const back = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - back);
  return day.toISOString().slice(0, 10);
}

/** `isoDate` plus `days` calendar days. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d + days));
  return day.toISOString().slice(0, 10);
}

/** "HH:MM" of a postgres TIME, for string comparison. */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function describeLesson(
  lesson: LessonCounts,
  today: string,
  nowTime: string,
): LessonView {
  const isToday = lesson.date === today;
  const off = OFF_STATUSES.has(lesson.status);
  const started =
    lesson.date < today || (isToday && hhmm(lesson.startTime) <= hhmm(nowTime));
  const attendanceDone = lesson.marked >= lesson.roster;
  const finished = off || (started && attendanceDone);

  let attendanceLabel: string;
  let attendanceTone: Tone = "default";

  if (off) {
    attendanceLabel = lesson.status === "cancelled" ? "Cancelled" : "Rescheduled";
  } else if (!started) {
    attendanceLabel = isToday ? "Today" : "Upcoming";
    attendanceTone = isToday ? "info" : "default";
  } else {
    if (lesson.roster === 0) {
      attendanceLabel = "No students";
    } else if (lesson.marked === 0) {
      attendanceLabel = "Not marked";
      attendanceTone = "warn";
    } else {
      const absent = lesson.absent > 0 ? ` · ${lesson.absent} absent` : "";
      attendanceLabel = `${Math.min(lesson.marked, lesson.roster)} of ${lesson.roster} marked${absent}`;
      attendanceTone = attendanceDone ? "good" : "warn";
    }
  }

  let action: LessonView["action"] = "view";
  if (!off) {
    if (isToday && !finished) action = "open";
    else if (started && !attendanceDone) action = "attendance";
  }

  return {
    ...lesson,
    isToday,
    started,
    finished,
    attendanceLabel,
    attendanceTone,
    action,
  };
}

/**
 * Lessons up to the end of this week, split into the three sections. Past
 * lessons that still need attendance go to "Needs finishing" (newest
 * first); the rest of this week reads in date order; anything older that is
 * complete is "Done" (newest first). Lessons after this week are left out.
 */
export function groupLessons(
  lessons: LessonCounts[],
  today: string,
  nowTime: string,
): LessonGroups {
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const groups: LessonGroups = { thisWeek: [], needsFinishing: [], done: [] };

  for (const lesson of lessons) {
    if (lesson.date > weekEnd) continue;
    const view = describeLesson(lesson, today, nowTime);
    if (lesson.date < today && !view.finished) groups.needsFinishing.push(view);
    else if (lesson.date >= weekStart) groups.thisWeek.push(view);
    else groups.done.push(view);
  }

  const asc = (a: LessonView, b: LessonView) =>
    a.date === b.date
      ? a.startTime.localeCompare(b.startTime)
      : a.date.localeCompare(b.date);
  groups.thisWeek.sort(asc);
  groups.needsFinishing.sort((a, b) => asc(b, a));
  groups.done.sort((a, b) => asc(b, a));
  return groups;
}

/** Count of past lessons still needing attendance (the tab badge). */
export function needsFinishingCount(
  lessons: LessonCounts[],
  today: string,
  nowTime: string,
): number {
  return lessons.filter(
    (l) => l.date < today && !describeLesson(l, today, nowTime).finished,
  ).length;
}

export type TermDates = {
  id: string;
  termNumber: number;
  startDate: string;
  endDate: string;
};

/**
 * "Week 2" for a lesson in the current term, "Term 3, Week 10" for one in
 * another term, null outside every term (holidays).
 */
export function termWeekLabel(
  date: string,
  termList: TermDates[],
  currentTermId: string | null,
): string | null {
  const term = termList.find((t) => t.startDate <= date && date <= t.endDate);
  if (!term) return null;
  const week = weekNumberOn(term.startDate, date);
  return term.id === currentTermId
    ? `Week ${week}`
    : `Term ${term.termNumber}, Week ${week}`;
}
