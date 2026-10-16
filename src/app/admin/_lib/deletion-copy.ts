import type { ClassDeletionImpact } from "./class-lessons";
import type { SubjectDeletionImpact } from "./actions-subjects";

/** A sentence whose `{ strong }` parts are shown in bold. */
export type RichText = (string | { strong: string })[];

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The normal "Delete this class?" dialog's list. */
export function classDeletionItems(impact: ClassDeletionImpact): RichText[] {
  const items: RichText[] = [
    [
      impact.pastLessons === 0
        ? "No lessons have run yet, so no attendance or marks are lost."
        : "Its past lessons have no attendance, notes or marks, so none are lost.",
    ],
  ];
  if (impact.enrolled > 0) {
    items.push([
      `${plural(impact.enrolled, "student")} ${impact.enrolled === 1 ? "comes" : "come"} off this class. Their other classes stay.`,
    ]);
  }
  if (impact.upcomingLessons > 0) {
    items.push(["Upcoming lessons disappear from every calendar."]);
  }
  if (impact.moveRequests > 0) {
    items.push([
      `${plural(impact.moveRequests, "class move request")} for this class ${impact.moveRequests === 1 ? "is" : "are"} cancelled.`,
    ]);
  }
  return items;
}

/** "This class has history": why it cannot be deleted yet. */
export function classBlockedBody(recordedLessons: number): RichText {
  return [
    "It has ",
    { strong: plural(recordedLessons, "lesson") },
    " with attendance, notes or marks. To keep that record safe, delete those lessons first. Once none are left, you can delete the class.",
  ];
}

/** The "Delete <subject>?" dialog's list of what is permanently lost. */
export function subjectDeletionItems(impact: SubjectDeletionImpact): RichText[] {
  const items: RichText[] = [];
  if (impact.classes > 0) {
    items.push(
      impact.lessons > 0
        ? [
            { strong: plural(impact.classes, "class", "classes") },
            " and ",
            { strong: plural(impact.lessons, "lesson") },
            " with their attendance",
          ]
        : [{ strong: plural(impact.classes, "class", "classes") }],
    );
  }
  if (impact.weeks > 0) {
    items.push([
      { strong: `${plural(impact.weeks, "week")} of curriculum` },
      ": videos, booklets and quizzes",
    ]);
  }
  if (impact.homework > 0) {
    items.push([{ strong: plural(impact.homework, "homework task") }, " and every mark on them"]);
  }
  if (impact.students > 0) {
    items.push(["Progress for ", { strong: plural(impact.students, "student") }, " in this subject"]);
  }
  if (impact.openCredits > 0) {
    items.push([{ strong: plural(impact.openCredits, "unused make-up credit") }]);
  }
  return items;
}
