/*
 * Pure availability maths shared by the tutor schedule ("Your regular week")
 * and the cover board ("You're free then"). Mirrors the rules that
 * `expandAvailability` in ./availability.ts applies when offering slots:
 *
 * - weekly rows repeat on their weekday;
 * - a date carrying the day-isolation sentinel (00:00:00-23:59:59,
 *   unavailable) ignores the weekly rows, so only that date's own available
 *   rows count;
 * - any other unavailable date row removes the matching weekly slot;
 * - available date rows add to the day.
 *
 * Times are "HH:MM" or "HH:MM:SS" Melbourne wall time; dates are YYYY-MM-DD.
 */

export type WeeklyAvailabilityRow = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

export type DateAvailabilityRow = {
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export type MinuteWindow = { start: number; end: number };

const SENTINEL_START = "00:00:00";
const SENTINEL_END = "23:59:59";

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalise(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

/** Sort and merge touching or overlapping windows. */
export function mergeWindows(windows: MinuteWindow[]): MinuteWindow[] {
  const sorted = [...windows]
    .filter((window) => window.end > window.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MinuteWindow[] = [];
  for (const window of sorted) {
    const last = merged.at(-1);
    if (last && window.start <= last.end) {
      last.end = Math.max(last.end, window.end);
    } else {
      merged.push({ ...window });
    }
  }
  return merged;
}

/** JS weekday (Sun = 0) of a calendar date, independent of the server zone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

/** The merged windows a tutor is available on one calendar date. */
export function availableWindowsOnDate(
  weekly: readonly WeeklyAvailabilityRow[],
  dateRows: readonly DateAvailabilityRow[],
  date: string,
): MinuteWindow[] {
  const rows = dateRows.filter((row) => row.date === date);
  const isolated = rows.some(
    (row) =>
      !row.isAvailable &&
      normalise(row.startTime) === SENTINEL_START &&
      normalise(row.endTime) === SENTINEL_END,
  );
  const removed = new Set(
    rows
      .filter((row) => !row.isAvailable)
      .map((row) => `${normalise(row.startTime)}|${normalise(row.endTime)}`),
  );
  const weekday = weekdayOf(date);
  const fromWeekly = isolated
    ? []
    : weekly.filter(
        (row) =>
          row.weekday === weekday &&
          !removed.has(`${normalise(row.startTime)}|${normalise(row.endTime)}`),
      );
  return mergeWindows(
    [...fromWeekly, ...rows.filter((row) => row.isAvailable)].map((row) => ({
      start: timeToMinutes(row.startTime),
      end: timeToMinutes(row.endTime),
    })),
  );
}

/** True when [startTime, endTime) sits entirely inside one window. */
export function coversTime(
  windows: readonly MinuteWindow[],
  startTime: string,
  endTime: string,
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return windows.some((window) => window.start <= start && window.end >= end);
}

export type WeekdayWindows = {
  /** JS weekday, Sun = 0. Rows are ordered Monday first. */
  weekday: number;
  windows: Array<MinuteWindow & { ruleIds: string[] }>;
};

/** Weekly rows merged per weekday, Monday first, every day present. */
export function weeklyWindowsByDay(
  weekly: readonly WeeklyAvailabilityRow[],
): WeekdayWindows[] {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const rows = weekly
      .filter((row) => row.weekday === weekday)
      .map((row) => ({
        start: timeToMinutes(row.startTime),
        end: timeToMinutes(row.endTime),
        id: row.id,
      }))
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const windows: Array<MinuteWindow & { ruleIds: string[] }> = [];
    for (const row of rows) {
      const last = windows.at(-1);
      if (last && row.start <= last.end) {
        last.end = Math.max(last.end, row.end);
        last.ruleIds.push(row.id);
      } else {
        windows.push({ start: row.start, end: row.end, ruleIds: [row.id] });
      }
    }
    return { weekday, windows };
  });
}
