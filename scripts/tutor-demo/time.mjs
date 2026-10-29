// Melbourne calendar helpers for the demo seed. The portal stores lesson
// dates and times as Melbourne wall time and timestamps as instants, so the
// seed converts between the two the same way.

const TZ = "Australia/Melbourne";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wall(instant) {
  const p = Object.fromEntries(parts.formatToParts(instant).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

/** Today's Melbourne date, YYYY-MM-DD. */
export function melbourneToday(now = new Date()) {
  return wall(now).date;
}

/** The instant a Melbourne wall date and time ("HH:MM") falls on. */
export function melbourneInstant(isoDate, hhmm) {
  const guess = new Date(`${isoDate}T${hhmm}:00Z`);
  // Two passes settle the offset across a daylight-saving change.
  let instant = guess;
  for (let i = 0; i < 2; i++) {
    const w = wall(instant);
    const asUtc = new Date(`${w.date}T${w.time}Z`);
    instant = new Date(guess.getTime() - (asUtc.getTime() - instant.getTime()));
  }
  return instant;
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday, as `classes.weekday` stores it. */
export function weekdayOf(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

export function mondayOf(isoDate) {
  return addDays(isoDate, -((weekdayOf(isoDate) + 6) % 7));
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(isoDate) {
  return WEEKDAY_NAMES[weekdayOf(isoDate)];
}

/** Same rule as src/lib/week-plan-rules.ts: 1-based week of the term. */
export function weekNumberOn(termStart, isoDate) {
  const days = (Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${termStart}T00:00:00Z`)) / 86_400_000;
  return Math.max(1, Math.floor(days / 7) + 1);
}

export function minutesBetween(start, end) {
  const m = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(end) - m(start);
}

/** Same as src/lib/format.ts: "4:30 pm", "6 pm". */
export function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** Same as src/lib/format.ts: "4:30 - 6 pm", "11:30 am - 12:30 pm". */
export function formatTimeRange(start, end) {
  const from = formatTime(start);
  const to = formatTime(end);
  return `${from.slice(-2) === to.slice(-2) ? from.slice(0, -3) : from} - ${to}`;
}
