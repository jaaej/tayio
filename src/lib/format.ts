/**
 * Shared formatters used across every role portal. Australian locale.
 * Anything specific to one role should NOT live here.
 */

const weekdayLong = new Intl.DateTimeFormat("en-AU", { weekday: "long" });
const weekdayShort = new Intl.DateTimeFormat("en-AU", { weekday: "short" });
const monthShort = new Intl.DateTimeFormat("en-AU", { month: "short" });
const dateLong = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const melbourneDateLong = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "long",
  day: "numeric",
  month: "long",
});
// Short months as the server writes them in a date: "13 June", "15 Sept".
// Safari writes "Jun" and "Sep", so a date a browser draws with Intl would
// differ from the server's (and break hydration). Every short date uses this.
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

export function parseLessonDate(date: string): Date {
  // `lessons.date` is a postgres DATE - stringified as YYYY-MM-DD; treat as local.
  return new Date(`${date}T00:00:00`);
}

/** A DATE string reads as that calendar day; a moment reads as its Melbourne day. */
export function formatDateLong(date: string | Date) {
  return typeof date === "string"
    ? dateLong.format(parseLessonDate(date))
    : melbourneDateLong.format(date);
}

/** A postgres DATE (YYYY-MM-DD) as "13 June". */
export function formatDateShort(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

/** A postgres DATE as "Tue 30 June": no comma after the weekday, as en-AU would add. */
export function formatDayDate(date: string) {
  return `${formatWeekday(date, "short")} ${formatDateShort(date)}`;
}

export function formatWeekday(date: string, style: "long" | "short" = "long") {
  return (style === "long" ? weekdayLong : weekdayShort).format(
    parseLessonDate(date),
  );
}

/** Short month of a postgres DATE (YYYY-MM-DD): "Oct", "Sept". */
export function formatMonthShort(date: string) {
  return monthShort.format(parseLessonDate(date));
}

/**
 * A postgres TIME ("HH:MM" or "HH:MM:SS", 24h) as the portal writes every
 * time: "4 pm", "4:30 pm", "12 pm".
 */
export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/**
 * A time range as the portal writes every one: "4 - 5:30 pm", or
 * "11:30 am - 12:30 pm" when it crosses noon. The meridiem is always written
 * so a mistyped 02:10 can never pass for 14:10. A plain hyphen, because the
 * portal's font draws an en dash as long as an em dash.
 */
export function formatTimeRange(start: string, end: string) {
  const from = formatTime(start);
  const to = formatTime(end);
  const shared = from.slice(-2) === to.slice(-2);
  return `${shared ? from.slice(0, -3) : from} - ${to}`;
}

/** A due moment as its Melbourne day: "Fri 24 Oct" (servers run in UTC). */
export function formatDueDate(d: Date) {
  return `${melbourneWeekday.format(d)} ${formatDayMonth(d)}`;
}

/** A homework score is a percentage the tutor awards: "85%", "92.5%". */
export function formatScore(score: string | number): string {
  return `${Math.round(Number(score) * 10) / 10}%`;
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
  return formatDayMonth(d);
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

/** A Monday week: "12 - 18 Oct", or "28 Sept - 4 Oct" across a month. */
export function weekRangeLabel(weekStartIso: string): string {
  const endDate = parseLessonDate(weekStartIso);
  endDate.setDate(endDate.getDate() + 6);
  const end = isoDate(endDate);
  const start = weekStartIso.slice(0, 7) === end.slice(0, 7)
    ? String(Number(weekStartIso.slice(8, 10)))
    : formatDateShort(weekStartIso);
  return `${start} - ${formatDateShort(end)}`;
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
const melbourneClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: MELBOURNE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const melbourneWeekday = new Intl.DateTimeFormat("en-AU", {
  timeZone: MELBOURNE_TZ,
  weekday: "short",
});
/** Melbourne calendar day of an instant, as YYYY-MM-DD. */
export function melbourneDayKey(d: Date): string {
  const parts = melbourneDayKeyFormat.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** A moment's Melbourne day and month: "25 Oct", or "25 Oct 2026". */
export function formatDayMonth(d: Date, withYear = false): string {
  const [y, m, day] = melbourneDayKey(d).split("-").map(Number);
  return `${day} ${MONTH_SHORT[m - 1]}${withYear ? ` ${y}` : ""}`;
}

function melbourneDayNumber(d: Date): number {
  const [y, m, day] = melbourneDayKey(d).split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86_400_000;
}

/**
 * Melbourne wall-clock time of an instant, written like every other time:
 * "9:41 am", "4 pm". Built from the 24h digits, so the server and every
 * browser engine print the same label.
 */
export function formatClockTime(d: Date): string {
  return formatTime(melbourneClock.format(d));
}

/** An instant as its Melbourne date and time: "25 Oct, 4:30 pm", or "25 Oct 2026, 4:30 pm". */
export function formatDateTime(d: Date, withYear = false): string {
  return `${formatDayMonth(d, withYear)}, ${formatClockTime(d)}`;
}

function dayMonth(d: Date, now: Date): string {
  return formatDayMonth(d, melbourneDayKey(d).slice(0, 4) !== melbourneDayKey(now).slice(0, 4));
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
    return `${melbourneWeekday.format(d)} ${formatDayMonth(d)}`;
  }
  return dayMonth(d, now);
}

const melbourneHour = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hour: "numeric",
  hourCycle: "h23",
});

/** "Good morning" / "Good afternoon" / "Good evening" by Melbourne time, for
 * every portal home header. */
export function melbourneGreeting(now: Date): string {
  const hour = Number(melbourneHour.format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
