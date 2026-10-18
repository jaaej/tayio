import { checkinApprovalTimingError } from "@/lib/tutor-checkin-rules";

export type CheckinWeekState = {
  weekStart: string;
  status: "pending" | "approved" | "disputed";
  entries: { workDate: string; endTime: string; isRemoved: boolean }[];
};

/**
 * Weeks waiting on the tutor to confirm, oldest first: still pending, with at
 * least one lesson, and every lesson finished (approval is refused before
 * then). A week with a correction request waits on admin, not the tutor.
 */
export function pendingCheckinWeeks(weeks: readonly CheckinWeekState[], now: Date): string[] {
  return weeks
    .filter(
      (week) =>
        week.status === "pending" &&
        week.entries.some((entry) => !entry.isRemoved) &&
        checkinApprovalTimingError(week.entries, now) === null,
    )
    .map((week) => week.weekStart)
    .sort();
}
