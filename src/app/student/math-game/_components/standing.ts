/**
 * Leaderboard ordering and the end-of-round summary, kept free of database
 * and React code so the board, the result screen and the server action all
 * rank players the same way.
 */

export type StandingRow = {
  studentId: string;
  best: number;
  firstAt: Date;
};

/** Higher best first; ties go to whoever first played the level, then a
 * stable id order so the board never reshuffles between loads. */
export function compareStanding(a: StandingRow, b: StandingRow): number {
  return (
    Number(b.best) - Number(a.best) ||
    new Date(a.firstAt).getTime() - new Date(b.firstAt).getTime() ||
    a.studentId.localeCompare(b.studentId)
  );
}

/** 1-based rank of `studentId` among `rows`, or null when they have no score. */
export function rankOf(rows: StandingRow[], studentId: string): number | null {
  const index = [...rows].sort(compareStanding).findIndex((row) => row.studentId === studentId);
  return index < 0 ? null : index + 1;
}

/** The player's rank on one level board before and after a saved round.
 * `scope` is the board the lobby opens on: their year when it is set,
 * otherwise all of Taiyo. */
export type RankChange = {
  scope: "year" | "all";
  yearLevel: string | null;
  before: number | null;
  after: number;
};

export type RoundOutcome = {
  isRecord: boolean;
  /** The best this round beat, when there was one to beat. */
  upFrom: number | null;
  /** The new rank, only when the round moved the player up the board. */
  newRank: number | null;
};

export function roundOutcome(
  score: number,
  previousBest: number,
  rank: RankChange | null,
): RoundOutcome {
  const isRecord = score > 0 && score > previousBest;
  const moved = rank !== null && (rank.before === null || rank.after < rank.before);
  return {
    isRecord,
    upFrom: isRecord && previousBest > 0 ? previousBest : null,
    newRank: moved ? rank.after : null,
  };
}

/** "Year 9" for a bare "9", leaving an already-labelled value alone. */
export function formatYear(yearLevel: string | null): string {
  if (!yearLevel) return "My year";
  return /^year\s/i.test(yearLevel) ? yearLevel : `Year ${yearLevel}`;
}
