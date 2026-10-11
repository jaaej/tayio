/**
 * Time defaults for the class forms. Times are postgres TIME strings in 24h
 * ("16:00" or "16:00:00"), Melbourne local, exactly what <input type="time">
 * reads and writes.
 */

/** After-school start: puts a 12-hour picker on PM from the first render. */
export const DEFAULT_START_TIME = "16:00";
/** Used when no existing class has a usable time range. */
export const FALLBACK_LESSON_MINUTES = 60;

const LAST_MINUTE = 23 * 60 + 59;

export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const clamped = Math.min(Math.max(Math.round(total), 0), LAST_MINUTE);
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function durationMinutes(start: string | null | undefined, end: string | null | undefined) {
  const a = timeToMinutes(start);
  const b = timeToMinutes(end);
  return a !== null && b !== null && b > a ? b - a : null;
}

/**
 * The most common lesson length among existing classes, so a new class
 * starts from what this centre actually runs. Ties go to the shorter length.
 */
export function usualLessonMinutes(
  rows: { startTime: string | null; endTime: string | null }[],
): number {
  const counts = new Map<number, number>();
  for (const row of rows) {
    const d = durationMinutes(row.startTime, row.endTime);
    if (d !== null) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [d, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && d < best)) {
      best = d;
      bestCount = count;
    }
  }
  return best ?? FALLBACK_LESSON_MINUTES;
}

/** End time `lessonMinutes` after `start`, kept strictly after it. */
export function endTimeFor(start: string, lessonMinutes: number): string {
  const s = timeToMinutes(start);
  if (s === null) return "";
  const length = lessonMinutes > 0 ? lessonMinutes : FALLBACK_LESSON_MINUTES;
  // A start at 23:59 has no later time in the day; leave the end for the
  // admin to fix rather than inventing one that fails validation.
  if (s >= LAST_MINUTE) return "";
  return minutesToTime(Math.min(s + length, LAST_MINUTE));
}

/** Initial start and end for the New class form. */
export function defaultClassTimes(lessonMinutes: number) {
  return {
    startTime: DEFAULT_START_TIME,
    endTime: endTimeFor(DEFAULT_START_TIME, lessonMinutes),
  };
}

/**
 * When the start moves, the end moves with it and keeps the lesson's length
 * (or the usual length if the old range was empty or backwards).
 */
export function endTimeAfterStartChange(input: {
  previousStart: string;
  previousEnd: string;
  nextStart: string;
  lessonMinutes: number;
}): string {
  if (timeToMinutes(input.nextStart) === null) return input.previousEnd;
  const length =
    durationMinutes(input.previousStart, input.previousEnd) ?? input.lessonMinutes;
  return endTimeFor(input.nextStart, length);
}

/** "1 h 30 m", "1 h", "45 m"; null for an empty or backwards range. */
export function durationLabel(start: string, end: string): string | null {
  const d = durationMinutes(start, end);
  if (d === null) return null;
  const hours = Math.floor(d / 60);
  const minutes = d % 60;
  if (hours === 0) return `${minutes} m`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} m`;
}
