/**
 * Pure rules behind the student's subject page: the "This week's work"
 * checklist (video, booklet, homework, and the quiz once approved), its
 * progress count, the rail's complete/locked hints and the small date labels.
 * No database or React here so it can be unit tested.
 */

import { isAwaitingMarking, isHomeworkOverdue, isMarked } from "@/lib/homework-rules";

export type ChecklistWeek = {
  videoUrl: string | null;
  bookletUrl: string | null;
  videoWatchedAt: Date | null;
  bookletOpenedAt: Date | null;
  homework: Array<{
    homeworkId: string;
    title: string;
    dueDate: Date;
    status: string;
    score: string | null;
  }>;
  quiz: { id: string; title: string; questionCount: number } | null;
  quizAttempt: { correctCount: number; total: number } | null;
};

export type ChecklistKind = "video" | "booklet" | "homework" | "quiz";

/**
 * done: finished. todo: available and not finished. overdue: homework past
 * its due date and not handed in. waiting: the tutor has not uploaded it yet.
 */
export type ChecklistState = "done" | "todo" | "overdue" | "waiting";

export type ChecklistTask = {
  key: string;
  kind: ChecklistKind;
  title: string;
  state: ChecklistState;
  meta: string;
  /** Page link for homework and the quiz; video and booklet act in place. */
  href: string | null;
  /** Homework only: the tutor asked for it to be handed in again. */
  resubmit?: boolean;
};

const shortDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const weekdayOnly = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
});

const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Melbourne",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function melbourneKey(date: Date): string {
  return dayKey.format(date);
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) /
      86_400_000,
  );
}

/** "Sat 17 Oct" in Melbourne time. */
export function shortDay(date: Date): string {
  return shortDate.format(date).replace(",", "");
}

/**
 * A short Melbourne-time stamp for something that happened: "today",
 * "yesterday", the weekday within the last week ("Sun"), else "Sat 17 Oct".
 */
export function pastDayLabel(date: Date, now: Date): string {
  const diff = daysBetween(melbourneKey(date), melbourneKey(now));
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return weekdayOnly.format(date);
  return shortDay(date);
}

/** Week 1 releases on the term start date; each next week 7 days later. */
export function curriculumWeekUnlockDate(
  termStartDate: string,
  weekNumber: number,
): string {
  const start = Date.parse(`${termStartDate}T00:00:00Z`);
  const unlock = new Date(start + Math.max(0, weekNumber - 1) * 7 * 86_400_000);
  return unlock.toISOString().slice(0, 10);
}

/** Tooltip for a locked week: "Unlocks Mon 20 Oct". */
export function unlockLabel(unlocksOn: string): string {
  // Noon UTC keeps the calendar day the same in Melbourne.
  return `Unlocks ${shortDay(new Date(`${unlocksOn}T12:00:00Z`))}`;
}

function homeworkTask(
  hw: ChecklistWeek["homework"][number],
  now: Date,
): ChecklistTask {
  const base = {
    key: `homework-${hw.homeworkId}`,
    kind: "homework" as const,
    title: hw.title,
    href: `/student/homework/${hw.homeworkId}`,
  };
  if (isMarked(hw.status)) {
    const score = hw.score === null ? null : `${Math.round(Number(hw.score) * 10) / 10}%`;
    return { ...base, state: "done", meta: score ? `Marked · ${score}` : "Marked" };
  }
  if (isAwaitingMarking(hw.status)) {
    return { ...base, state: "done", meta: "Submitted · waiting for marking" };
  }
  const pastDue = isHomeworkOverdue(hw.status, melbourneKey(hw.dueDate), melbourneKey(now));
  if (hw.status === "resubmission_requested") {
    return {
      ...base,
      resubmit: true,
      state: pastDue ? "overdue" : "todo",
      meta: `Resubmit · due ${shortDay(hw.dueDate)}`,
    };
  }
  return pastDue
    ? { ...base, state: "overdue", meta: `Overdue · was due ${shortDay(hw.dueDate)}` }
    : { ...base, state: "todo", meta: `Due ${shortDay(hw.dueDate)}` };
}

/**
 * The week's work in the order a student does it: watch, read, homework,
 * then the practice quiz. The quiz only appears once an admin approved it;
 * a video or booklet the tutor has not uploaded yet shows as waiting.
 */
export function weekChecklist(
  week: ChecklistWeek,
  opts: { now: Date; tutorFirstName: string | null },
): ChecklistTask[] {
  const who = opts.tutorFirstName ?? "Your tutor";
  const tasks: ChecklistTask[] = [];

  tasks.push(
    !week.videoUrl
      ? {
          key: "video",
          kind: "video",
          title: "Recorded lesson",
          state: "waiting",
          meta: `${who} will upload it soon`,
          href: null,
        }
      : week.videoWatchedAt
        ? {
            key: "video",
            kind: "video",
            title: "Recorded lesson",
            state: "done",
            meta: `Watched ${pastDayLabel(week.videoWatchedAt, opts.now)}`,
            href: null,
          }
        : {
            key: "video",
            kind: "video",
            title: "Recorded lesson",
            state: "todo",
            meta: "Not watched yet",
            href: null,
          },
  );

  tasks.push(
    !week.bookletUrl
      ? {
          key: "booklet",
          kind: "booklet",
          title: "Week booklet",
          state: "waiting",
          meta: `${who} will upload it soon`,
          href: null,
        }
      : week.bookletOpenedAt
        ? {
            key: "booklet",
            kind: "booklet",
            title: "Week booklet",
            state: "done",
            meta: `Opened ${pastDayLabel(week.bookletOpenedAt, opts.now)}`,
            href: null,
          }
        : {
            key: "booklet",
            kind: "booklet",
            title: "Week booklet",
            state: "todo",
            meta: "Not opened yet",
            href: null,
          },
  );

  const homework = [...week.homework].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  );
  for (const hw of homework) tasks.push(homeworkTask(hw, opts.now));

  if (week.quiz) {
    const questions = `${week.quiz.questionCount} ${week.quiz.questionCount === 1 ? "question" : "questions"}`;
    tasks.push({
      key: `quiz-${week.quiz.id}`,
      kind: "quiz",
      title: week.quiz.title,
      state: week.quizAttempt ? "done" : "todo",
      meta: week.quizAttempt
        ? `Practice quiz · ${week.quizAttempt.correctCount}/${week.quizAttempt.total} correct`
        : `Practice quiz · ${questions}`,
      href: `/student/quizzes/${week.quiz.id}`,
    });
  }

  return tasks;
}

/** Done out of what the student can do now; waiting items are not counted. */
export function checklistProgress(tasks: ChecklistTask[]): {
  done: number;
  total: number;
} {
  const available = tasks.filter((task) => task.state !== "waiting");
  return {
    done: available.filter((task) => task.state === "done").length,
    total: available.length,
  };
}

/** A week is complete when everything available in it is done. */
export function weekComplete(tasks: ChecklistTask[]): boolean {
  const { done, total } = checklistProgress(tasks);
  return total > 0 && done === total;
}
