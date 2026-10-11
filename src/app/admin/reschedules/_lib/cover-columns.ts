import {
  COVER_URGENT_24_HOURS,
  MIN_COVER_NOTICE_HOURS,
  hoursUntilLesson,
} from "@/lib/tutor-cover-rules";

/*
 * Cover board columns. Pure so the bucketing can be unit tested: lesson dates
 * and times are Melbourne wall time, so urgency is measured from the real
 * lesson start instant, never from the server clock's calendar day.
 */

export const COVER_COLUMNS = ["urgent", "open", "covered"] as const;
export type CoverColumn = (typeof COVER_COLUMNS)[number];

export const COVER_COLUMN_LABEL: Record<CoverColumn, string> = {
  urgent: "Under 24 hours",
  open: "Needs cover",
  covered: "Covered",
};

type BoardRow = {
  status: "open" | "claimed" | string;
  date: string;
  startTime: string;
};

export function coverColumnFor(row: BoardRow, now: Date): CoverColumn {
  if (row.status === "claimed") return "covered";
  return hoursUntilLesson(row.date, row.startTime, now) <= COVER_URGENT_24_HOURS
    ? "urgent"
    : "open";
}

/** True for an open request inside the minimum notice window (24 to 48h). */
export function isInsideNoticeWindow(row: BoardRow, now: Date): boolean {
  if (row.status === "claimed") return false;
  const hours = hoursUntilLesson(row.date, row.startTime, now);
  return hours > COVER_URGENT_24_HOURS && hours <= MIN_COVER_NOTICE_HOURS;
}

/** Split board rows into the three columns, keeping their incoming order. */
export function bucketCoverBoard<T extends BoardRow>(
  rows: readonly T[],
  now: Date,
): Record<CoverColumn, T[]> {
  const columns: Record<CoverColumn, T[]> = { urgent: [], open: [], covered: [] };
  for (const row of rows) columns[coverColumnFor(row, now)].push(row);
  return columns;
}
