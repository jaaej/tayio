import "server-only";

import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mathGameScores, profiles } from "@/db/schema";
import type { Difficulty } from "./_components/question-generator";

const DIFFICULTIES: Difficulty[] = [
  "sprint",
  "easy",
  "medium",
  "hard",
  "genius",
];

export type LeaderboardRow = {
  rank: number;
  name: string;
  score: number;
  isMe: boolean;
};

export type LeaderboardBoard = {
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
};

export type LeaderboardBoards = Record<Difficulty, LeaderboardBoard>;

export type BlitzOverallRank = {
  rank: number;
  totalPlayers: number;
  score: number;
} | null;

function displayName(firstName: string, lastName: string | null): string {
  const first = firstName.trim() || "Student";
  const initial = (lastName ?? "").trim().charAt(0);
  return initial ? `${first} ${initial}.` : first;
}

/** Fetch all five difficulty boards in one query. An optional year value
 * narrows the same ranking logic to peers in that year. */
export async function getLeaderboardBoards(
  meId: string,
  yearLevel?: string | null,
): Promise<LeaderboardBoards> {
  const rows = await db
    .select({
      difficulty: mathGameScores.difficulty,
      studentId: mathGameScores.studentId,
      best: sql<number>`max(${mathGameScores.score})`.as("best"),
      firstAt: sql<Date>`min(${mathGameScores.playedAt})`.as("first_at"),
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(mathGameScores)
    .innerJoin(profiles, eq(profiles.id, mathGameScores.studentId))
    .where(
      and(
        eq(profiles.isActive, true),
        yearLevel ? eq(profiles.yearLevel, yearLevel) : undefined,
      ),
    )
    .groupBy(
      mathGameScores.difficulty,
      mathGameScores.studentId,
      profiles.firstName,
      profiles.lastName,
    );

  return Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [
      difficulty,
      boardFromRows(
        rows.filter((row) => row.difficulty === difficulty),
        meId,
      ),
    ]),
  ) as LeaderboardBoards;
}

function boardFromRows(
  rows: Array<{
    studentId: string;
    best: number;
    firstAt: Date;
    firstName: string;
    lastName: string | null;
  }>,
  meId: string,
): LeaderboardBoard {
  const ranked: LeaderboardRow[] = rows
    .sort(
      (a, b) =>
        Number(b.best) - Number(a.best) ||
        new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime() ||
        a.studentId.localeCompare(b.studentId),
    )
    .map((row, index) => ({
      rank: index + 1,
      name: displayName(row.firstName, row.lastName),
      score: Number(row.best),
      isMe: row.studentId === meId,
    }));

  const me = ranked.find((row) => row.isMe) ?? null;
  const top = ranked.slice(0, 20);
  return {
    top,
    me: me && !top.some((row) => row.isMe) ? me : null,
  };
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
  for (const row of rows) bests[row.difficulty as Difficulty] = Number(row.best);
  return bests;
}

export async function getStudentYearLevel(studentId: string) {
  const [row] = await db
    .select({ yearLevel: profiles.yearLevel })
    .from(profiles)
    .where(eq(profiles.id, studentId))
    .limit(1);
  return row?.yearLevel?.trim() || null;
}

/** Whole-centre rank shown on the Taiyo Blitz entry tile. It is the sum of a
 * student's personal best across all levels, so repeated runs cannot inflate
 * the result. */
export const getOverallBlitzRank = cache(
  async (studentId: string): Promise<BlitzOverallRank> => {
    const rows = await db
      .select({
        studentId: mathGameScores.studentId,
        difficulty: mathGameScores.difficulty,
        best: sql<number>`max(${mathGameScores.score})`.as("best"),
      })
      .from(mathGameScores)
      .innerJoin(profiles, eq(profiles.id, mathGameScores.studentId))
      .where(eq(profiles.isActive, true))
      .groupBy(mathGameScores.studentId, mathGameScores.difficulty);

    const totals = new Map<string, number>();
    for (const row of rows) {
      totals.set(
        row.studentId,
        (totals.get(row.studentId) ?? 0) + Number(row.best),
      );
    }
    const ranked = Array.from(totals, ([id, score]) => ({ id, score })).sort(
      (a, b) => b.score - a.score || a.id.localeCompare(b.id),
    );
    const index = ranked.findIndex((row) => row.id === studentId);
    if (index < 0) return null;
    return {
      rank: index + 1,
      totalPlayers: ranked.length,
      score: ranked[index].score,
    };
  },
);
