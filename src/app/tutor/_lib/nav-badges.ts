import "server-only";
import { getClaimableCovers } from "@/app/tutor/cover/_lib/queries";

/** Quiz statuses that need the assigned tutor to act. */
export const TUTOR_QUIZ_TODO_STATUSES = ["requested", "changes_requested"] as const;

/** Open covers on the board that this tutor can take (`getClaimableCovers`). */
export async function getClaimableCoverCount(tutorId: string) {
  return (await getClaimableCovers(tutorId)).length;
}
