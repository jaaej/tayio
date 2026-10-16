/** The levels a subject can be set to, in order. Stored as shown. */
export const YEAR_LEVELS = [
  "Year 3",
  "Year 4",
  "Year 5",
  "Year 6",
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
  "VCE",
];

/** The Level options, keeping a saved value that is not in the list. */
export function yearLevelOptions(current: string | null | undefined): string[] {
  const saved = current?.trim();
  return saved && !YEAR_LEVELS.includes(saved) ? [...YEAR_LEVELS, saved] : YEAR_LEVELS;
}
