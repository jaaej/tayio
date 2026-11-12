import { formatDateLong, formatTimeRange } from "@/lib/format";
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

/** Melbourne wall-clock time, HH:MM:SS (servers run in UTC). */
export function melbourneTime(now = new Date()): string {
  const p = partsAt(now);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(p.hour)}:${two(p.minute)}:${two(p.second)}`;
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
    formatTimeRange(row.startTime, row.endTime)
  );
}

/** Time left before a class, in the unit a person would say it. */
export function formatTimeUntil(hours: number): string {
  const plural = (count: number, unit: string) =>
    `${count} ${unit}${count === 1 ? "" : "s"}`;
  if (hours < 1) return plural(Math.max(1, Math.floor(hours * 60)), "minute");
  if (hours < MIN_COVER_NOTICE_HOURS) return plural(Math.floor(hours), "hour");
  return plural(Math.floor(hours / 24), "day");
}

/**
 * A cover handed back to the board (by an admin, or by the tutor who had
 * claimed it) is announced once. That announcement stands in for the deadline
 * alert of the window the class is already in, so the sweep never sends a
 * second urgent message for the same moment; later windows still alert.
 */
export function coverReturnedAlertFlags(hoursRemaining: number, now: Date) {
  if (hoursRemaining <= COVER_URGENT_24_HOURS) {
    return { alert48SentAt: now, alert24SentAt: now };
  }
  if (hoursRemaining <= MIN_COVER_NOTICE_HOURS) {
    return { alert48SentAt: now, alert24SentAt: null };
  }
  return { alert48SentAt: null, alert24SentAt: null };
}

/** The admin notice (and email) for a cover returned to the board. */
export function coverReturnedNotice(
  lessonDescription: string,
  hoursRemaining: number,
): { title: string; body: string } {
  return {
    title:
      hoursRemaining <= MIN_COVER_NOTICE_HOURS
        ? "URGENT: Cover returned to the board"
        : "Cover returned to the board",
    body:
      `${lessonDescription} needs a replacement again. ` +
      `The class starts in ${formatTimeUntil(hoursRemaining)}.`,
  };
}

/**
 * How many "still waiting for a decision" reminders a pending leave request
 * should have had by now: the n-th falls due 24 * n hours after it was made.
 */
export function pendingLeaveRemindersDue(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
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
