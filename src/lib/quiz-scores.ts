import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { quizAttempts, quizzes } from "@/db/schema";

/** A student's latest attempt at each quiz in the given subjects. */
export async function getLatestQuizAttempts(
  studentId: string,
  subjectIds: string[],
): Promise<Array<{ quizId: string; correctCount: number; total: number }>> {
  if (subjectIds.length === 0) return [];
  const rows = await db
    .select({
      quizId: quizAttempts.quizId,
      correctCount: quizAttempts.correctCount,
      total: quizAttempts.total,
      submittedAt: quizAttempts.submittedAt,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .where(
      and(eq(quizAttempts.studentId, studentId), inArray(quizzes.subjectId, subjectIds)),
    );
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const prev = latest.get(r.quizId);
    if (!prev || r.submittedAt > prev.submittedAt) latest.set(r.quizId, r);
  }
  return [...latest.values()].map(({ quizId, correctCount, total }) => ({
    quizId,
    correctCount,
    total,
  }));
}
