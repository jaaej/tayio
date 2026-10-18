import { classDisplayName } from "@/lib/class-display";
import type { LessonView } from "@/lib/lesson-progress";
import { lessonDatesLabel } from "@/lib/tutor-today";

/*
 * Pure wording for the tutor's lessons that still need attendance or notes,
 * shared by Today, the Classes cards, the class Lessons tab and the lesson
 * links, so one lesson's next step reads the same everywhere.
 */

/** The button for a lesson, from `describeLesson`'s `action`. */
export const LESSON_ACTION_LABEL: Record<LessonView["action"], string> = {
  open: "Open lesson",
  attendance: "Mark attendance",
  notes: "Finish notes",
  view: "View",
};

export type FinishingLesson = Pick<LessonView, "id" | "date" | "status" | "action"> & {
  classId: string;
  className: string;
  subjectName: string;
};

/** Each class's lessons to finish, as its Lessons tab counts them (make-ups
 *  are one student's catch-up, not the class's run of lessons). */
export function finishingByClass(lessons: readonly FinishingLesson[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lesson of lessons) {
    if (lesson.status === "makeup") continue;
    counts.set(lesson.classId, (counts.get(lesson.classId) ?? 0) + 1);
  }
  return counts;
}

/** Up to this many dates are listed on Today; more read as "oldest ...". */
const DATES_LISTED = 3;

/**
 * Today's one "lessons need finishing" row: how many, which lesson the button
 * opens (the oldest, `lessons` oldest first) and what it asks for there.
 */
export function finishingTodo(lessons: readonly FinishingLesson[]): {
  title: string;
  detail: string;
  href: string;
  action: string;
} | null {
  const oldest = lessons[0];
  if (!oldest) return null;
  const label = classDisplayName(oldest.subjectName, oldest.className);
  const classCount = new Set(lessons.map((l) => l.classId)).size;
  const detail =
    classCount === 1 && lessons.length <= DATES_LISTED
      ? `${label} · ${lessonDatesLabel(lessons.map((l) => l.date))}`
      : `Oldest: ${label}, ${lessonDatesLabel([oldest.date])}`;
  return {
    title:
      lessons.length === 1
        ? "1 lesson needs finishing"
        : `${lessons.length} lessons need finishing`,
    detail,
    href: `/tutor/lessons/${oldest.id}`,
    action: LESSON_ACTION_LABEL[oldest.action],
  };
}
