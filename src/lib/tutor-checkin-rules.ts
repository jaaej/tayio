import { lessonStartInstant } from "@/lib/tutor-cover-rules";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(\d{2}):(\d{2})(?::\d{2})?$/;

export function addIsoDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekStartForIsoDate(value: string): string {
  const date = parseIsoDate(value);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function checkinMinutes(startTime: string, endTime: string): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const minutes = end - start;
  if (minutes <= 0 || minutes > 24 * 60) {
    throw new Error("Finish time must be after start time.");
  }
  return minutes;
}

export function checkinPay(minutes: number, hourlyRate: string | number): number {
  const rate = Number(hourlyRate);
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error("Worked minutes must be zero or greater.");
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("Hourly rate must be zero or greater.");
  }

  // Calculate with integer rate cents so weekly and monthly totals always
  // equal the sum of the visible, cent-rounded lesson rows.
  const rateCents = Math.round(rate * 100);
  return Math.round((minutes * rateCents) / 60) / 100;
}

export function checkinApprovalTimingError(
  entries: Array<{
    workDate: string;
    endTime: string;
    isRemoved: boolean;
  }>,
  now = new Date(),
): string | null {
  const unfinished = entries
    .filter((entry) => !entry.isRemoved)
    .find(
      (entry) => lessonStartInstant(entry.workDate, entry.endTime) > now,
    );
  return unfinished
    ? "Wait until every scheduled lesson in this week has finished before approving the hours."
    : null;
}

export function checkinReminderDay(
  date: string,
): "saturday" | "sunday" | null {
  const day = parseIsoDate(date).getUTCDay();
  if (day === 6) return "saturday";
  if (day === 0) return "sunday";
  return null;
}

function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error("Use a valid date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Use a valid date.");
  }
  return date;
}

function parseTime(value: string): number {
  const match = TIME.exec(value);
  if (!match) throw new Error("Use a valid time.");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error("Use a valid time.");
  return hours * 60 + minutes;
}
