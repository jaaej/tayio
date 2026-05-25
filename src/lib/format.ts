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
  // `lessons.date` is a postgres DATE — stringified as YYYY-MM-DD; treat as local.
  return new Date(`${date}T00:00:00`);
}

export function formatDateLong(date: string) {
  return dateLong.format(parseLessonDate(date));
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
  // postgres TIME comes back as HH:MM:SS — drop seconds, convert to 12h.
  const [h, m] = t.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m}${suffix}`;
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

export function relativeTime(d: Date) {
  const diffHours = Math.round((Date.now() - d.getTime()) / 36e5);
  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const days = Math.round(diffHours / 24);
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
  return d.toISOString().slice(0, 10);
}

export function weekKey(date: string): string {
  const monday = startOfMondayWeek(parseLessonDate(date));
  return monday.toISOString().slice(0, 10);
}

export function weekRangeLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${dateShort.format(start)} – ${dateShort.format(end)}`;
}
