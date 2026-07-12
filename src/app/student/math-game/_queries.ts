import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mathGameScores, profiles } from "@/db/schema";
import type { Difficulty } from "./_components/question-generator";

export type LeaderboardRow = {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
};

function displayName(firstName: string | null, lastName: string | null): string {
  const first = (firstName ?? "").trim() || "Student";
  const initial = (lastName ?? "").trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
}

// Best score per student for one difficulty, ranked by best desc then earliest
// achievement (tie-break approximated by the student's earliest play time).
export async function getLeaderboard(
  difficulty: Difficulty,
  meId: string,
): Promise<{ top: LeaderboardRow[]; me: LeaderboardRow | null }> {
  const rows = await db
    .select({
      studentId: mathGameScores.studentId,
      best: sql<number>`max(${mathGameScores.score})`.as("best"),
      firstAt: sql<string>`min(${mathGameScores.playedAt})`.as("first_at"),
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(mathGameScores)
    .innerJoin(profiles, eq(profiles.id, mathGameScores.studentId))
    .where(eq(mathGameScores.difficulty, difficulty))
    .groupBy(mathGameScores.studentId, profiles.firstName, profiles.lastName)
    .orderBy(desc(sql`best`), asc(sql`first_at`));

  const ranked: LeaderboardRow[] = rows.map((r, i) => ({
    rank: i + 1,
    name: displayName(r.firstName, r.lastName),
    score: Number(r.best),
    isMe: r.studentId === meId,
  }));

  const me = ranked.find((r) => r.isMe) ?? null;
  const top = ranked.slice(0, 20);
  // Only surface a separate "me" row when the student is outside the top 20.
  const meOutsideTop = me && !top.some((r) => r.isMe) ? me : null;

  return { top, me: meOutsideTop };
}

export type MyBests = Record<Difficulty, number>;

export async function getMyBests(studentId: string): Promise<MyBests> {
  const rows = await db
    .select({
      difficulty: mathGameScores.difficulty,
      best: sql<number>`max(${mathGameScores.score})`.as("best"),
    })
    .from(mathGameScores)
    .where(eq(mathGameScores.studentId, studentId))
    .groupBy(mathGameScores.difficulty);

  const bests: MyBests = { sprint: 0, easy: 0, medium: 0, hard: 0, genius: 0 };
  for (const r of rows) bests[r.difficulty as Difficulty] = Number(r.best);
  return bests;
}
