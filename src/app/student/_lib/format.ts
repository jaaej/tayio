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
  return (style === "long" ? weekdayLong : weekdayShort).format(parseLessonDate(date));
}

export function formatTime(t: string) {
  // postgres TIME comes back as HH:MM:SS — drop seconds.
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

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Monday-start week.
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function weekKey(date: string): string {
  const monday = startOfWeek(parseLessonDate(date));
  return monday.toISOString().slice(0, 10);
}

export function weekRangeLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${dateShort.format(start)} – ${dateShort.format(end)}`;
}

export const LESSON_STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  missed: "Missed",
  rescheduled: "Rescheduled",
  makeup: "Make-up class",
};

export const LESSON_STATUS_STYLE: Record<string, string> = {
  upcoming: "bg-brand-100 text-navy-800",
  completed: "bg-brand-50 text-ink-soft",
  cancelled: "bg-rose-100 text-rose-800",
  missed: "bg-amber-100 text-amber-900",
  rescheduled: "bg-amber-100 text-amber-900",
  makeup: "bg-emerald-100 text-emerald-900",
};

export const HOMEWORK_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  viewed: "Viewed",
  submitted: "Submitted",
  late: "Late",
  marked: "Marked",
  returned: "Returned",
  resubmission_requested: "Resubmit",
};

export const HOMEWORK_STATUS_STYLE: Record<string, string> = {
  not_started: "bg-brand-100 text-navy-800",
  viewed: "bg-brand-100 text-navy-800",
  submitted: "bg-emerald-100 text-emerald-900",
  late: "bg-amber-100 text-amber-900",
  marked: "bg-emerald-100 text-emerald-900",
  returned: "bg-emerald-100 text-emerald-900",
  resubmission_requested: "bg-rose-100 text-rose-800",
};
