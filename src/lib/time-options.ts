/**
 * The times a time dropdown offers: every `stepMinutes` from `from` to `to`
 * (HH:MM, 24h), plus `keep` (a saved time off the grid, so it still shows).
 */
export function timeOptions(
  { from = "06:00", to = "22:00", stepMinutes = 15, keep }: { from?: string; to?: string; stepMinutes?: number; keep?: string },
): string[] {
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const times = new Set<string>();
  for (let m = minutes(from); m <= minutes(to); m += stepMinutes) times.add(hhmm(m));
  const kept = keep?.slice(0, 5);
  if (kept && /^\d{2}:\d{2}$/.test(kept)) times.add(kept);
  return [...times].sort();
}


