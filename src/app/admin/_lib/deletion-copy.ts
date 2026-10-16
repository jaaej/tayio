import type { ClassDeletionImpact } from "./class-lessons";
import type { SubjectDeletionImpact } from "./actions-subjects";

function count(n: number, one: string, many = `${one}s`): string | null {
  if (n <= 0) return null;
  return `${n} ${n === 1 ? one : many}`;
}

/** The confirmation dialog's list of what deleting a class removes. */
export function classDeletionItems(impact: ClassDeletionImpact): string[] {
  return [
    count(impact.pastLessons, "past lesson"),
    count(impact.attendanceRecords, "attendance record"),
    count(impact.lessonNotes, "lesson note"),
    count(impact.announcements, "class announcement"),
    count(impact.upcomingLessons, "upcoming lesson"),
    count(impact.enrolled, "student's place in the class", "students' places in the class"),
    count(impact.moveRequests, "class move request"),
  ].filter((item): item is string => item !== null);
}

/** The confirmation dialog's list of what deleting a subject removes. */
export function subjectDeletionItems(impact: SubjectDeletionImpact): string[] {
  const quizzes = count(impact.quizzes, "quiz", "quizzes");
  const attempts = count(impact.quizAttempts, "student attempt");
  return [
    count(impact.weeks, "curriculum week"),
    count(impact.topics, "topic"),
    quizzes && attempts ? `${quizzes} and ${attempts}` : quizzes,
    count(impact.resources, "resource"),
    count(impact.discussionThreads, "discussion thread"),
    count(impact.openCredits, "unused make-up credit"),
  ].filter((item): item is string => item !== null);
}
