/**
 * Shared formatters used across every role portal. Australian locale.
 * Anything specific to one role should NOT live here.
 */

const weekdayLong = new Intl.DateTimeFormat("en-AU", { weekday: "long" });
const weekdayShort = new Intl.DateTimeFormat("en-AU", { weekday: "short" });
const dateLong = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dateShort = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
});

export function parseLessonDate(date: string): Date {
  // `lessons.date` is a postgres DATE - stringified as YYYY-MM-DD; treat as local.
  return new Date(`${date}T00:00:00`);
}

export function formatDateLong(date: string | Date) {
  return dateLong.format(typeof date === "string" ? parseLessonDate(date) : date);
}

export function formatDateShort(date: string) {
  return dateShort.format(parseLessonDate(date));
}

export function formatWeekday(date: string, style: "long" | "short" = "long") {
  return (style === "long" ? weekdayLong : weekdayShort).format(
    parseLessonDate(date),
  );
}

export function formatTime(t: string) {
  // postgres TIME comes back as HH:MM:SS - drop seconds, convert to 12h.
  const [h, m] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m}${suffix}`;
}

/**
 * A lesson's time range from two postgres TIME (24h) values, e.g.
 * "4:00 – 5:30 pm", or "11:30 am – 12:30 pm" when it crosses noon. The
 * meridiem is always written so a mistyped 02:10 can never pass for 14:10.
 */
export function formatTimeRange(start: string, end: string) {
  const parts = (t: string) => {
    const [h, m] = t.split(":");
    const hour = Number(h);
    return {
      clock: `${hour % 12 === 0 ? 12 : hour % 12}:${m}`,
      suffix: hour >= 12 ? "pm" : "am",
    };
  };
  const a = parts(start);
  const b = parts(end);
  return a.suffix === b.suffix
    ? `${a.clock} – ${b.clock} ${b.suffix}`
    : `${a.clock} ${a.suffix} – ${b.clock} ${b.suffix}`;
}

export function formatDueDate(d: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatMoney(n: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function relativeTime(d: Date, now: Date | number = Date.now()) {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const diffMinutes = Math.max(0, Math.floor((nowMs - d.getTime()) / 60_000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const days = Math.floor(diffHours / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function startOfMondayWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // JS getDay: 0=Sun..6=Sat → Mon-first index
  const dayToMon = [6, 0, 1, 2, 3, 4, 5];
  x.setDate(x.getDate() - dayToMon[x.getDay()]);
  return x;
}

export function isoDate(d: Date) {
  // Local calendar date, NOT toISOString(): lesson/date columns store local
  // calendar dates, so keying via UTC shifts a day on any timezone ahead of UTC
  // (e.g. AEST/UTC+10) and mismatches the data. Local components are correct on
  // any server timezone.
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function weekKey(date: string): string {
  const monday = startOfMondayWeek(parseLessonDate(date));
  return isoDate(monday);
}

export function weekRangeLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${dateShort.format(start)} – ${dateShort.format(end)}`;
}

/**
 * Year levels are stored as free text ("Year 10", "VCE") or a bare number
 * ("10"). Prefix "Year" only to a bare number so labels never read
 * "Year Year 10".
 */
export function yearLevelLabel(value: string): string {
  const v = value.trim();
  return /^\d+$/.test(v) ? `Year ${v}` : v;
}

/*
 * Inbox timestamps (messages and notifications). Formatted in Melbourne time
 * explicitly: servers run in UTC, and a label rendered on the server must read
 * the same as the one the browser renders on hydration.
 */
const MELBOURNE_TZ = "Australia/Melbourne";
const melbourneDayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: MELBOURNE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const melbourneClock = new Intl.DateTimeFormat("en-AU", {
  timeZone: MELBOURNE_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const melbourneWeekday = new Intl.DateTimeFormat("en-AU", {
  timeZone: MELBOURNE_TZ,
  weekday: "short",
});
const melbourneDayMonth = new Intl.DateTimeFormat("en-AU", {
  timeZone: MELBOURNE_TZ,
  day: "numeric",
  month: "short",
});
const melbourneDayMonthYear = new Intl.DateTimeFormat("en-AU", {
  timeZone: MELBOURNE_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Melbourne calendar day of an instant, as YYYY-MM-DD. */
export function melbourneDayKey(d: Date): string {
  return melbourneDayKeyFormat.format(d);
}

function melbourneDayNumber(d: Date): number {
  const [y, m, day] = melbourneDayKey(d).split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/** Melbourne wall-clock time, e.g. "9:41 am". */
export function formatClockTime(d: Date): string {
  return melbourneClock
    .format(d)
    .replace(/[  ]/g, " ")
    .toLowerCase();
}

function dayMonth(d: Date, now: Date): string {
  return melbourneDayKey(d).slice(0, 4) === melbourneDayKey(now).slice(0, 4)
    ? melbourneDayMonth.format(d)
    : melbourneDayMonthYear.format(d);
}

/**
 * Compact inbox stamp: the time today, "Yesterday", the weekday within the
 * last week, then the date (with the year once it is not this year).
 */
export function inboxStamp(d: Date, now: Date = new Date()): string {
  const days = melbourneDayNumber(now) - melbourneDayNumber(d);
  if (days <= 0) return formatClockTime(d);
  if (days === 1) return "Yesterday";
  if (days < 7) return melbourneWeekday.format(d);
  return dayMonth(d, now);
}

/** Day divider inside a conversation: "Today", "Yesterday", "Thu 9 Oct". */
export function conversationDayLabel(d: Date, now: Date = new Date()): string {
  const days = melbourneDayNumber(now) - melbourneDayNumber(d);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) {
    return `${melbourneWeekday.format(d)} ${melbourneDayMonth.format(d)}`;
  }
  return dayMonth(d, now);
}
