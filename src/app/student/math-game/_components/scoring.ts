import type { Difficulty } from "./question-generator";

export const SCORE_CAPS: Record<Difficulty, number> = {
  easy: 150,
  medium: 120,
  hard: 100,
  genius: 80,
};

export function isPlausibleScore(difficulty: Difficulty, score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= SCORE_CAPS[difficulty];
}
