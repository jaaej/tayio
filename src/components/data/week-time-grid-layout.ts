/**
 * Layout rules for `WeekTimeGrid`, kept apart from the drawing so they can be
 * tested: which hours to show, and how a day's lessons share its column.
 */

import { formatTimeRange } from "@/lib/format";

export type GridTime = { startTime: string; endTime: string };

/** Minutes after midnight for "HH:MM" or "HH:MM:SS". */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** `formatTimeRange` ("4:30 - 6:30 pm") with each time kept on one line with
 *  its am or pm (a no-break space), so a narrow block wraps after the hyphen. */
export function timeRangeLabel(start: string, end: string): string {
  return formatTimeRange(start, end).replace(/ (am|pm)/g, "\u00a0$1");
}

/** "1 class", "3 classes", "2 lessons": a count with its noun (singular given). */
export function countLabel(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}${noun.endsWith("s") ? "es" : "s"}`}`;
}

/** The working day shown by "Show full day", widened to fit any lesson. */
const FULL_DAY = { start: 8, end: 21 };

/**
 * Hours to draw, as [startHour, endHour). Fitted: an hour either side of the
 * week's lessons. Full: 8 am to 9 pm, widened to fit them. A week with no
 * lessons always shows the full day.
 */
export function gridHours(events: GridTime[], full: boolean): { start: number; end: number } {
  if (events.length === 0) return FULL_DAY;
  const first = Math.min(...events.map((e) => minutesOf(e.startTime)));
  const last = Math.max(...events.map((e) => minutesOf(e.endTime)));
  const fitted = {
    start: Math.max(0, Math.floor(first / 60) - 1),
    end: Math.min(24, Math.ceil(last / 60) + 1),
  };
  if (!full) return fitted;
  return { start: Math.min(FULL_DAY.start, fitted.start), end: Math.max(FULL_DAY.end, fitted.end) };
}

/** Whether "Show full day" would show more than the fitted hours. */
export function fullDayDiffers(events: GridTime[]): boolean {
  const fitted = gridHours(events, false);
  const full = gridHours(events, true);
  return fitted.start !== full.start || fitted.end !== full.end;
}

/** Side by side up to this many at once; more fold into one card. */
export const MAX_SIDE_BY_SIDE = 2;

export type PlacedEvent<E> = { kind: "event"; event: E; start: number; end: number; lane: number; lanes: number };

export type PlacedGroup<E> = {
  kind: "group";
  /** Sorted by start time, then end time. */
  events: E[];
  start: number;
  end: number;
  /** Where the next lessons in the day begin, so the card stops above them. */
  nextStart: number | null;
};

export type Placed<E> = PlacedEvent<E> | PlacedGroup<E>;

/**
 * A day's lessons, placed: lessons that overlap form a cluster; each takes
 * the first free lane, and a cluster that needs more than two lanes at once
 * becomes one card listing its lessons, so a busy slot never squeezes into
 * slivers.
 */
export function placeDay<E extends GridTime>(events: E[]): Placed<E>[] {
  const sorted = events
    .map((event) => ({ event, start: minutesOf(event.startTime), end: minutesOf(event.endTime) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const clusters: { start: number; end: number; items: PlacedEvent<E>[] }[] = [];
  for (const item of sorted) {
    let cluster = clusters[clusters.length - 1];
    if (!cluster || item.start >= cluster.end) {
      cluster = { start: item.start, end: item.end, items: [] };
      clusters.push(cluster);
    }
    const taken = new Set(cluster.items.filter((c) => c.end > item.start).map((c) => c.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.items.push({ kind: "event", ...item, lane, lanes: 1 });
    cluster.end = Math.max(cluster.end, item.end);
  }

  return clusters.flatMap((cluster, i): Placed<E>[] => {
    const lanes = Math.max(...cluster.items.map((c) => c.lane + 1));
    if (lanes > MAX_SIDE_BY_SIDE) {
      return [
        {
          kind: "group",
          events: cluster.items.map((c) => c.event),
          start: cluster.start,
          end: cluster.end,
          nextStart: clusters[i + 1]?.start ?? null,
        },
      ];
    }
    return cluster.items.map((c) => ({ ...c, lanes }));
  });
}

/**
 * A day's share of the week's width: the most lessons it shows side by side
 * (a folded card counts as the most there can be). Sharing the width this
 * way makes every lesson block the same width whatever day it is on; equal
 * days made a lone lesson twice as wide as two side by side.
 */
export function dayWidthShare<E>(placed: Placed<E>[]): number {
  return placed.reduce(
    (most, p) => Math.max(most, p.kind === "group" ? MAX_SIDE_BY_SIDE : p.lanes),
    1,
  );
}

/**
 * Heights in px inside a folded card (`GroupCard`), fixed in its CSS so the
 * grid can make room for the whole card: border and padding, the
 * "4:30 - 6:30 pm · 3 classes" header with the gap under it, a row per
 * lesson with the gap between rows, a small time label over each later
 * start or end, and the space kept above and below the card.
 */
export const GROUP_CARD_PX = { chrome: 14, header: 24, row: 26, rowGap: 2, timeLabel: 20, margin: 6 };

/** The height of a folded card listing these lessons: one time label per
 *  start and end, the first in the header (`GroupCard`). */
export function groupCardHeight(events: GridTime[]): number {
  const { chrome, header, row, rowGap, timeLabel: label } = GROUP_CARD_PX;
  const times = new Set(events.map((e) => `${minutesOf(e.startTime)}-${minutesOf(e.endTime)}`)).size;
  return chrome + header + events.length * row + (events.length - 1) * rowGap + (times - 1) * label;
}

/**
 * Pixels per hour for the week: `base`, or taller when a folded card needs
 * more room than its time gives it before the day's next lessons (or the end
 * of the grid), so the card never cuts off its last lessons or runs into the
 * next ones. At most three times `base`; past that the card scrolls.
 */
export function hourPxFor(days: Placed<GridTime>[][], endHour: number, base: number): number {
  let px = base;
  for (const day of days) {
    for (const p of day) {
      if (p.kind !== "group") continue;
      const minutes = (p.nextStart ?? endHour * 60) - p.start;
      px = Math.max(px, Math.ceil(((groupCardHeight(p.events) + GROUP_CARD_PX.margin) * 60) / minutes));
    }
  }
  return Math.min(px, base * 3);
}
