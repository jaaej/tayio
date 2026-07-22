"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { mathGameScores } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import type { Difficulty } from "./_components/question-generator";
import { isPlausibleScore } from "./_components/scoring";

const submitSchema = z.object({
  difficulty: z.enum(["sprint", "easy", "medium", "hard", "genius"]),
  score: z.number().int().min(0),
});

export async function submitScore(
  difficulty: Difficulty,
  score: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole("student");

  const parsed = submitSchema.safeParse({ difficulty, score });
  if (!parsed.success) return { ok: false, error: "Invalid submission" };

  if (!isPlausibleScore(parsed.data.difficulty, parsed.data.score)) {
    return { ok: false, error: "Implausible score" };
  }

  // Don't record a scoreless run — it would put the player on the leaderboard
  // with a best of 0.
  if (parsed.data.score === 0) return { ok: true };

  await db.insert(mathGameScores).values({
    studentId: user.id,
    difficulty: parsed.data.difficulty,
    score: parsed.data.score,
  });

  revalidatePath("/student/math-game");
  return { ok: true };
}
