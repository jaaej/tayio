import { formatDateShort } from "@/lib/format";
import { melbourneDate } from "@/lib/tutor-cover-rules";

/**
 * A quiz carries two staff notes, kept apart so neither overwrites the other:
 * the admin's brief (`note`) and the latest change request from a review
 * (`reviewNote`). Every place that shows them (the admin and tutor quiz
 * pages, the tutor's week card) labels them the same way.
 */
export type QuizNote = {
  key: "brief" | "review";
  label: string;
  text: string;
  /** "12 Oct" for a change request. */
  date: string | null;
  tone: "default" | "bad";
};

export function quizNotes(quiz: {
  status: string;
  note: string | null;
  reviewNote: string | null;
  reviewNoteAt: Date | null;
}): QuizNote[] {
  const notes: QuizNote[] = [];
  const brief = quiz.note?.trim();
  if (brief) notes.push({ key: "brief", label: "Instructions", text: brief, date: null, tone: "default" });
  const review = quiz.reviewNote?.trim();
  if (review) {
    notes.push({
      key: "review",
      label: "Changes requested",
      text: review,
      date: quiz.reviewNoteAt ? formatDateShort(melbourneDate(quiz.reviewNoteAt)) : null,
      // Still to act on while the quiz is back with the tutor.
      tone: quiz.status === "changes_requested" ? "bad" : "default",
    });
  }
  return notes;
}
