import type { PillTone } from "@/components/admin/ui";
import { formatDateLong } from "@/lib/format";
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

export function leaveRangeLabel(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDateLong(startDate)
    : `${formatDateLong(startDate)} – ${formatDateLong(endDate)}`;
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
