import { addIsoDays, checkinPay } from "@/lib/tutor-checkin-rules";

/*
 * Pure derivations behind the tutor check-in week matrix (tutors x days).
 * Kept free of React and the database so the status rules are unit tested.
 */

export type WeekStatus = "pending" | "approved" | "disputed";

/** Colour of one tutor/day cell. */
export type CellStatus =
  | "approved" // the tutor approved the week
  | "issue" // the tutor reported the week as wrong
  | "corrected" // pending, and an admin changed a row on this day
  | "waiting" // pending, waiting on the tutor to approve
  | "removed"; // every row on this day was removed from pay

/** Status of a whole tutor row. "none" means no paid work this week. */
export type RowStatus = "approved" | "issue" | "waiting" | "none";

export type MatrixEntry = {
  id: string;
  classId: string | null;
  workDate: string;
  minutes: number;
  hourlyRate: string;
  isRemoved: boolean;
  isManualOverride: boolean;
};

export type MatrixCell = {
  date: string;
  status: CellStatus | null;
  /** Paid minutes on this day (removed rows excluded). */
  minutes: number;
  /** Paid lessons on this day (removed rows excluded). */
  lessonCount: number;
  /** Every row on this day, removed ones included, so they can be restored. */
  entryIds: string[];
};

export type MatrixRow = {
  cells: MatrixCell[];
  status: RowStatus;
  totalMinutes: number;
  totalPay: number;
  hasMissingRate: boolean;
  /** Distinct positive hourly rates on paid rows, ascending. */
  rates: number[];
  /** Every row in the (class-filtered) week, in date order. */
  entryIds: string[];
};

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addIsoDays(weekStart, i));
}

export function cellStatus(
  weekStatus: WeekStatus,
  entries: Pick<MatrixEntry, "isRemoved" | "isManualOverride">[],
): CellStatus | null {
  if (entries.length === 0) return null;
  const active = entries.filter((entry) => !entry.isRemoved);
  if (active.length === 0) return "removed";
  if (weekStatus === "approved") return "approved";
  if (weekStatus === "disputed") return "issue";
  if (entries.some((entry) => entry.isManualOverride)) return "corrected";
  return "waiting";
}

export function rowStatus(
  weekStatus: WeekStatus,
  entries: Pick<MatrixEntry, "isRemoved">[],
): RowStatus {
  if (!entries.some((entry) => !entry.isRemoved)) return "none";
  if (weekStatus === "approved") return "approved";
  if (weekStatus === "disputed") return "issue";
  return "waiting";
}

/**
 * One tutor's week as matrix cells plus row totals. `classId` narrows every
 * figure to one class, matching the page's class filter.
 */
export function buildMatrixRow(
  view: { status: WeekStatus; entries: MatrixEntry[] },
  weekStart: string,
  classId?: string,
): MatrixRow {
  const entries = classId
    ? view.entries.filter((entry) => entry.classId === classId)
    : view.entries;
  const active = entries.filter((entry) => !entry.isRemoved);

  const cells = weekDates(weekStart).map((date) => {
    const day = entries.filter((entry) => entry.workDate === date);
    const paid = day.filter((entry) => !entry.isRemoved);
    return {
      date,
      status: cellStatus(view.status, day),
      minutes: paid.reduce((sum, entry) => sum + entry.minutes, 0),
      lessonCount: paid.length,
      entryIds: day.map((entry) => entry.id),
    };
  });

  const rates = Array.from(
    new Set(
      active
        .map((entry) => Number(entry.hourlyRate))
        .filter((rate) => Number.isFinite(rate) && rate > 0),
    ),
  ).sort((a, b) => a - b);

  // Sum cent-rounded rows so the row total equals the visible lesson rows.
  const totalPay =
    Math.round(
      active.reduce(
        (sum, entry) => sum + checkinPay(entry.minutes, entry.hourlyRate) * 100,
        0,
      ),
    ) / 100;

  return {
    cells,
    status: rowStatus(view.status, entries),
    totalMinutes: active.reduce((sum, entry) => sum + entry.minutes, 0),
    totalPay,
    hasMissingRate: active.some((entry) => !(Number(entry.hourlyRate) > 0)),
    rates,
    entryIds: entries.map((entry) => entry.id),
  };
}

/** Header figures: pay the tutors approved, and rows still waiting on them. */
export function weekSummary(rows: Pick<MatrixRow, "status" | "totalPay">[]) {
  return {
    approvedPay:
      Math.round(
        rows
          .filter((row) => row.status === "approved")
          .reduce((sum, row) => sum + row.totalPay * 100, 0),
      ) / 100,
    awaiting: rows.filter(
      (row) => row.status === "waiting" || row.status === "issue",
    ).length,
  };
}

export function hoursLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0 && remainder > 0) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function rateLabel(rates: number[], hasMissingRate: boolean): string | null {
  if (hasMissingRate) return "Rate missing";
  if (rates.length === 0) return null;
  const fmt = (rate: number) =>
    Number.isInteger(rate) ? `$${rate}` : `$${rate.toFixed(2)}`;
  return rates.length === 1
    ? `${fmt(rates[0])}/hr`
    : `${fmt(rates[0])}-${fmt(rates[rates.length - 1])}/hr`;
}
