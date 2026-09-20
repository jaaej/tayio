import type { CoarseRole } from "@/lib/roles";

export type AccountSchedulePeriod = {
  kind: "student_break" | "tutor_leave";
  approval: "approved" | "pending";
  startDate: string;
  endDate: string;
};

/**
 * Pick the one dated schedule state that is most useful in a compact account
 * summary. Current periods beat future periods, and an approved tutor leave
 * beats a pending request covering the same dates.
 */
export function chooseAccountSchedulePeriod(
  role: CoarseRole,
  today: string,
  periods: AccountSchedulePeriod[],
): AccountSchedulePeriod | null {
  if (role !== "student" && role !== "tutor") return null;

  const expectedKind = role === "student" ? "student_break" : "tutor_leave";
  const relevant = periods.filter(
    (period) => period.kind === expectedKind && period.endDate >= today,
  );

  const rank = (period: AccountSchedulePeriod) => {
    const current = period.startDate <= today && today <= period.endDate;
    if (current && period.approval === "approved") return 0;
    if (current) return 1;
    if (period.approval === "approved") return 2;
    return 3;
  };

  return (
    [...relevant].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.startDate.localeCompare(b.startDate) ||
        a.endDate.localeCompare(b.endDate),
    )[0] ?? null
  );
}

export function accountScheduleStatusLabel(
  period: AccountSchedulePeriod,
  today: string,
): string {
  const current = period.startDate <= today && today <= period.endDate;
  if (period.kind === "student_break") {
    return current ? "On break" : "Break scheduled";
  }
  if (period.approval === "pending") return "Leave pending";
  return current ? "On leave" : "Leave approved";
}

export function freeTrialDirectoryState(
  period: { startDate: string; endDate: string } | null,
  today: string,
): "current" | "scheduled" | "ended" | null {
  if (!period) return null;
  if (today < period.startDate) return "scheduled";
  if (today <= period.endDate) return "current";
  return "ended";
}
