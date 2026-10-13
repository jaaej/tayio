import "server-only";
import { getCoverBoardRows } from "@/lib/tutor-cover";

/** Quiz statuses that need the assigned tutor to act. */
export const TUTOR_QUIZ_TODO_STATUSES = ["requested", "changes_requested"] as const;

/** Open covers on the board that this tutor could claim (not their own). */
export async function getClaimableCoverCount(tutorId: string) {
  const rows = await getCoverBoardRows();
  return rows.filter(
    (row) => row.status === "open" && row.originalTutorId !== tutorId,
  ).length;
}


