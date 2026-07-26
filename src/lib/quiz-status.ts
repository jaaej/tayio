/**
 * Shared quiz-status labels/tones for the admin and tutor quiz pages.
 * Tone values are plain strings (not a specific Pill's tone union) so each
 * call site can cast to whichever Pill component it renders with -
 * admin pages use `@/components/admin/ui`'s Pill, tutor pages use
 * `@/components/student/pill`'s Pill, and the two tone unions differ.
 */
export const QUIZ_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  requested: "Requested",
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const QUIZ_STATUS_TONE: Record<string, string> = {
  draft: "default",
  requested: "info",
  pending_review: "warn",
  changes_requested: "bad",
  approved: "good",
};
