"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { mathGameScores } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import type { Difficulty } from "./_components/question-generator";
import { isPlausibleScore } from "./_components/scoring";
import type { RankChange } from "./_components/standing";
import { getLevelRank, getStudentYearLevel } from "./_queries";

const submitSchema = z.object({
  difficulty: z.enum(["sprint", "easy", "medium", "hard", "genius"]),
  score: z.number().int().min(0),
});

export async function submitScore(
  difficulty: Difficulty,
  score: number,
): Promise<{ ok: true; rank: RankChange | null } | { ok: false; error: string }> {
  const user = await requireRole("student");

  const parsed = submitSchema.safeParse({ difficulty, score });
  if (!parsed.success) return { ok: false, error: "Invalid submission" };

  if (!isPlausibleScore(parsed.data.difficulty, parsed.data.score)) {
    return { ok: false, error: "Implausible score" };
  }

  // Don't record a scoreless run - it would put the player on the leaderboard
  // with a best of 0.
  if (parsed.data.score === 0) return { ok: true, rank: null };

  // Rank on the board the lobby opens on (the player's year when set), read
  // either side of the insert so the result screen can say if they moved up.
  const yearLevel = await getStudentYearLevel(user.id);
  const before = await getLevelRank(user.id, parsed.data.difficulty, yearLevel);

  await db.insert(mathGameScores).values({
    studentId: user.id,
    difficulty: parsed.data.difficulty,
    score: parsed.data.score,
  });

  const after = await getLevelRank(user.id, parsed.data.difficulty, yearLevel);

  revalidatePath("/student/math-game");
  return {
    ok: true,
    rank:
      after === null
        ? null
        : { scope: yearLevel ? "year" : "all", yearLevel, before, after },
  };
}
