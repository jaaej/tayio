/** 1-based week of the term that `isoDate` falls in. Both are YYYY-MM-DD. */
export function weekNumberOn(termStart: string, isoDate: string): number {
  const start = Date.UTC(
    Number(termStart.slice(0, 4)),
    Number(termStart.slice(5, 7)) - 1,
    Number(termStart.slice(8, 10)),
  );
  const day = Date.UTC(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  );
  return Math.max(1, Math.floor((day - start) / (7 * 86_400_000)) + 1);
}
