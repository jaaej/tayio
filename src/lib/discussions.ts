import type { UserRole } from "@/db/schema";

/**
 * Sentinel URL segment for the cross-subject Admin / Tech board.
 * Subject boards use the subject UUID; "admin" maps to subject_id IS NULL.
 */
export const ADMIN_BOARD_SEGMENT = "admin";

export type BoardId =
  | { kind: "subject"; subjectId: string }
  | { kind: "admin" };

export function resolveBoardId(segment: string): BoardId | null {
  if (segment === ADMIN_BOARD_SEGMENT) return { kind: "admin" };
  if (segment.length > 0) return { kind: "subject", subjectId: segment };
  return null;
}

export function boardSegment(board: BoardId): string {
  return board.kind === "admin" ? ADMIN_BOARD_SEGMENT : board.subjectId;
}

export function adminBoardLabel(): string {
  return "Admin / Tech";
}

export function subjectBoardLabel(subject: {
  name: string;
  yearLevel: string | null;
}): string {
  // subject.name in this codebase already includes the year prefix
  // (e.g. "Year 11 Chemistry"), so we don't re-prepend yearLevel.
  return subject.name;
}

export const DISCUSSION_ROLES: ReadonlyArray<UserRole> = [
  "student",
  "tutor",
  "admin",
] as const;
