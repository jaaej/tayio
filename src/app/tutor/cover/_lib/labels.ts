import type { PillTone } from "@/components/admin/ui";
import {
  COVER_URGENT_24_HOURS,
  MIN_COVER_NOTICE_HOURS,
} from "@/lib/tutor-cover-rules";

/* Wording shared by the tutor Cover board and the schedule's Time away list. */

export const LEAVE_STATUS: Record<
  "pending" | "approved" | "rejected" | "cancelled",
  { label: string; tone: PillTone }
> = {
  pending: { label: "Awaiting approval", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Declined", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "default" },
};

const DAY = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
// en-AU writes "Mon, 21 Dec"; the comma is dropped to match the rest of the portal.
const format = (formatter: Intl.DateTimeFormat, date: string) =>
  formatter.format(new Date(`${date}T00:00:00.000Z`)).replace(",", "");

/** "Thu 15 Oct", or a range such as "Mon 21 – Thu 24 Dec". */
export function leaveRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) return format(DAY_MONTH, startDate);
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  return `${format(sameMonth ? DAY : DAY_MONTH, startDate)} – ${format(DAY_MONTH, endDate)}`;
}

function classes(count: number) {
  return `${count} ${count === 1 ? "class" : "classes"}`;
}

/** "Family travel · 4 classes affected" / "· 3 of 4 classes covered". */
export function leaveDetail(row: {
  reason: string;
  status: keyof typeof LEAVE_STATUS;
  affected: number;
  covered: number;
}): string {
  if (row.status === "pending" && row.affected > 0) {
    return `${row.reason} · ${classes(row.affected)} affected`;
  }
  if (row.status === "approved" && row.affected > 0) {
    return `${row.reason} · ${row.covered} of ${classes(row.affected)} covered`;
  }
  return row.reason;
}

/** Urgency pill for an open cover request, or null when there is time. */
export function coverUrgencyLabel(hoursRemaining: number): string | null {
  if (hoursRemaining <= COVER_URGENT_24_HOURS) return "Under 24h";
  if (hoursRemaining <= MIN_COVER_NOTICE_HOURS) return "Under 48h";
  return null;
}
