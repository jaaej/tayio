export const RECURRING_LESSON_HORIZON_DAYS = 16 * 7;

function parseIsoDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function addIsoDays(iso: string, days: number) {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Calendar dates on which a weekly class occurs. Weekdays use the JavaScript
 * convention: Sunday = 0 through Saturday = 6.
 */
export function weeklyDatesInRange(input: {
  fromIso: string;
  throughIso: string;
  weekday: number;
}) {
  const { fromIso, throughIso, weekday } = input;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error(`Invalid weekday: ${weekday}`);
  }

  const cursor = parseIsoDate(fromIso);
  const through = parseIsoDate(throughIso);
  if (cursor > through) return [];

  const offset = (weekday - cursor.getUTCDay() + 7) % 7;
  cursor.setUTCDate(cursor.getUTCDate() + offset);

  const dates: string[] = [];
  while (cursor <= through) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

function minutesOfDay(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * A class's weekly time is copied onto every generated lesson, and payroll
 * check-ins refuse lessons that finish before they start. Reject the range at
 * the source. The AM/PM hint is there because the realistic mistake is a
 * 12-hour time picker left on AM (12:00 to 02:10 instead of 14:10).
 */
export function classTimeRangeError(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string | null {
  if (!startTime || !endTime) return null;
  return minutesOfDay(endTime) > minutesOfDay(startTime)
    ? null
    : "End time must be after the start time. Check AM and PM.";
}
