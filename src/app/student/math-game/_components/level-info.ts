import type { Difficulty } from "./question-generator";

export type LevelInfo = {
  key: Difficulty;
  label: string;
  /** Round length in seconds. */
  seconds: number;
  /** What the questions are, matching `question-generator.ts`. */
  summary: string;
  /** 1 (gentlest) to 5. */
  step: number;
};

export const LEVELS: LevelInfo[] = [
  { key: "sprint", label: "Sprint", seconds: 30, summary: "Adding numbers up to 20", step: 1 },
  { key: "easy", label: "Easy", seconds: 60, summary: "Adding two-digit numbers", step: 2 },
  {
    key: "medium",
    label: "Medium",
    seconds: 60,
    summary: "Adding, taking away and times tables",
    step: 3,
  },
  { key: "hard", label: "Hard", seconds: 60, summary: "All four operations", step: 4 },
  {
    key: "genius",
    label: "Genius",
    seconds: 60,
    summary: "Negatives, order of operations, powers and percentages",
    step: 5,
  },
];

export function levelInfo(key: Difficulty): LevelInfo {
  return LEVELS.find((level) => level.key === key)!;
}
