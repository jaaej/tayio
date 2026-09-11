import { formatDateLong, formatTime } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";

export const COVER_TIME_ZONE = "Australia/Melbourne";
export const MIN_COVER_NOTICE_HOURS = 48;
export const COVER_URGENT_24_HOURS = 24;
export const MAX_LEAVE_DAYS = 90;

const zonedPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: COVER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsAt(instant: Date) {
  const values = Object.fromEntries(
    zonedPartsFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function offsetAt(instant: Date): number {
  const p = partsAt(instant);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.trunc(instant.getTime() / 1000) * 1000
  );
}

/** Convert a DATE + TIME stored as Melbourne wall time into a real instant. */
export function lessonStartInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  // Resolve the timezone offset twice: the first pass gets us near the target;
  // the second handles dates on the other side of a daylight-saving boundary.
  let instant = new Date(wallClockUtc);
  instant = new Date(wallClockUtc - offsetAt(instant));
  instant = new Date(wallClockUtc - offsetAt(instant));
  return instant;
}

export function hoursUntilLesson(
  date: string,
  time: string,
  now = new Date(),
): number {
  return (lessonStartInstant(date, time).getTime() - now.getTime()) / 3_600_000;
}

export function melbourneDate(now = new Date()): string {
  const p = partsAt(now);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}`;
}

export function inclusiveDayCount(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  return Math.floor(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000,
  ) + 1;
}

export type CoverUrgency = "48h" | "24h" | "expired" | null;

/** Combine a subject and class name without repeating the shared prefix. */
export function tutorCoverClassLabel(
  subjectName: string,
  className: string,
): string {
  return classDisplayName(subjectName, className);
}

/** Omit the weekday from the date when it is already part of the class name. */
export function tutorCoverDateLabel(date: string, className: string): string {
  let dateLabel = formatDateLong(date);
  const weekday = dateLabel.split(" ")[0];
  const classWords = className
    .toLocaleLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (classWords.includes(weekday.toLocaleLowerCase())) {
    dateLabel = dateLabel.slice(weekday.length).trim();
  }
  return dateLabel;
}

/** Build a concise lesson label without repeating subject or weekday text. */
export function tutorCoverLessonDescription(row: {
  subjectName: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
}): string {
  const name = tutorCoverClassLabel(row.subjectName, row.className);
  const dateLabel = tutorCoverDateLabel(row.date, row.className);
  return (
    `${name}, ${dateLabel} ` +
    `${formatTime(row.startTime)}–${formatTime(row.endTime)}`
  );
}

/** Decide the next one-off escalation; 24h supersedes a missed 48h alert. */
export function nextCoverUrgency(input: {
  hoursRemaining: number;
  alert48Sent: boolean;
  alert24Sent: boolean;
}): CoverUrgency {
  if (input.hoursRemaining <= 0) return "expired";
  if (input.hoursRemaining <= COVER_URGENT_24_HOURS) {
    return input.alert24Sent ? null : "24h";
  }
  if (input.hoursRemaining <= MIN_COVER_NOTICE_HOURS) {
    return input.alert48Sent ? null : "48h";
  }
  return null;
}
