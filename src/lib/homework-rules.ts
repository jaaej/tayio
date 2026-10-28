/**
 * One homework rule for every role. Handed in means submitted (on time or
 * late), marked or returned: a late hand-in is done, not "due". Overdue means
 * not handed in after the due date (a Melbourne calendar date). A
 * resubmission request puts the work back in the student's hands.
 */

export const HANDED_IN_STATUSES = ["submitted", "late", "marked", "returned"] as const;

export function isHandedIn(status: string): boolean {
  return (HANDED_IN_STATUSES as readonly string[]).includes(status);
}

export function isMarked(status: string): boolean {
  return status === "marked" || status === "returned";
}

/** The tutor's marks on a submitted file reach the family once the work is marked or sent back. */
export function isFeedbackReleased(status: string): boolean {
  return isMarked(status) || status === "resubmission_requested";
}

/**
 * Can the student hand in (or hand in again)? Before handing in, yes; when
 * the tutor asked for a resubmission, yes; while waiting for marking, only if
 * the homework allows resubmission; once marked, no. The submit route and the
 * page both use this, so the page never offers what the route refuses.
 */
export function canSubmitHomework(status: string, allowResubmission: boolean): boolean {
  if (status === "not_started" || status === "viewed" || status === "resubmission_requested") {
    return true;
  }
  if (isAwaitingMarking(status)) return allowResubmission;
  return false;
}

/**
 * The status a hand-in is stored with: late when it comes in after the due
 * time, except a resubmission the tutor asked for, which answers their
 * request rather than the due date.
 */
export function handInStatus(previous: string, dueDate: Date, now: Date): "submitted" | "late" {
  if (previous === "resubmission_requested") return "submitted";
  return now > dueDate ? "late" : "submitted";
}

/** Handed in and waiting for the tutor. */
export function isAwaitingMarking(status: string): boolean {
  return status === "submitted" || status === "late";
}

/** `dueDate` and `today` are YYYY-MM-DD Melbourne dates. */
export function isHomeworkOverdue(status: string, dueDate: string, today: string): boolean {
  return !isHandedIn(status) && dueDate < today;
}

export type HomeworkState = "marked" | "to_mark" | "overdue" | "due_today" | "open";

export const HOMEWORK_STATE_LABEL: Record<HomeworkState, string> = {
  marked: "Marked",
  to_mark: "To mark",
  overdue: "Overdue",
  due_today: "Due today",
  open: "Not handed in",
};

/** Where a piece of homework stands, in the tutor's words. */
export function homeworkState(status: string, dueDate: string, today: string): HomeworkState {
  if (isMarked(status)) return "marked";
  if (isAwaitingMarking(status)) return "to_mark";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  return "open";
}
