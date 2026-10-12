import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { quizzes } from "@/db/schema";
import { getCoverBoardRows } from "@/lib/tutor-cover";

/** Quiz statuses that need the assigned tutor to act. */
export const TUTOR_QUIZ_TODO_STATUSES = ["requested", "changes_requested"] as const;

export async function getTutorQuizTodoCount(tutorId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quizzes)
    .where(
      and(
        eq(quizzes.assignedTutorId, tutorId),
        inArray(quizzes.status, [...TUTOR_QUIZ_TODO_STATUSES]),
      ),
    );
  return count ?? 0;
}

/** Open covers on the board that this tutor could claim (not their own). */
export async function getClaimableCoverCount(tutorId: string) {
  const rows = await getCoverBoardRows();
  return rows.filter(
    (row) => row.status === "open" && row.originalTutorId !== tutorId,
  ).length;
}


