/*
 * Who can take a new class at its day and time: the tutor picker in the
 * create-class panel lists every tutor, free ones first, the rest with a note
 * saying why. Pure so it is unit tested; times are Melbourne wall time
 * ("HH:MM" or "HH:MM:SS"), weekdays are JS weekdays (Sun = 0).
 */

import { coversTime, mergeWindows, timeToMinutes } from "@/lib/availability-windows";

/** A weekly availability row (date-specific rows do not apply to a weekly class). */
export type TutorWeeklyWindow = {
  tutorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  /** Null = any subject; set = only that subject. */
  subjectId: string | null;
};

/** An existing class, to spot a tutor who is free but already teaching then. */
export type TutorClassSlot = {
  tutorId: string;
  name: string;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
};

export type TutorFit = "free" | "busy" | "outside" | "unknown";

export type RankedTutor = {
  id: string;
  name: string;
  fit: TutorFit;
  /** Why the tutor is not free then; null for free (and before a day is set). */
  note: string | null;
};

const ORDER: Record<TutorFit, number> = { free: 0, unknown: 0, busy: 1, outside: 2 };

function validRange(start: string | null, end: string | null): start is string {
  return Boolean(start && end && timeToMinutes(start) < timeToMinutes(end!));
}

/**
 * Every tutor, ranked for the class's slot: free (available for the whole
 * class and not teaching another class then), then busy (available but
 * teaching another class then), then outside their available hours.
 * Alphabetical within each. Until a day and a valid time range are set,
 * every tutor is "unknown" and the list is simply alphabetical.
 */
export function rankTutorsForSlot(
  tutors: Array<{ id: string; firstName: string; lastName: string }>,
  windows: readonly TutorWeeklyWindow[],
  classSlots: readonly TutorClassSlot[],
  slot: {
    weekday: number | null;
    startTime: string | null;
    endTime: string | null;
    subjectId: string | null;
  },
): RankedTutor[] {
  const named = tutors.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`.trim() }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  if (slot.weekday === null || !validRange(slot.startTime, slot.endTime)) {
    return named.map((t) => ({ ...t, fit: "unknown" as const, note: null })).sort(byName);
  }
  const { weekday, startTime: start, endTime: end } = slot as {
    weekday: number;
    startTime: string;
    endTime: string;
  };
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  return named
    .map((t): RankedTutor => {
      const mine = windows.filter((w) => w.tutorId === t.id);
      const usable = mine.filter(
        (w) =>
          w.weekday === weekday &&
          (w.subjectId === null || slot.subjectId === null || w.subjectId === slot.subjectId),
      );
      const covered = coversTime(
        mergeWindows(
          usable.map((w) => ({ start: timeToMinutes(w.startTime), end: timeToMinutes(w.endTime) })),
        ),
        start,
        end,
      );
      const clash = classSlots.find(
        (c) =>
          c.tutorId === t.id &&
          c.weekday === weekday &&
          validRange(c.startTime, c.endTime) &&
          timeToMinutes(c.startTime!) < endMin &&
          startMin < timeToMinutes(c.endTime!),
      );
      if (covered && !clash) return { ...t, fit: "free", note: null };
      if (clash) return { ...t, fit: "busy", note: `Teaching ${clash.name} then` };
      return {
        ...t,
        fit: "outside",
        note: mine.length === 0 ? "No available hours set" : "Outside their available hours",
      };
    })
    .sort((a, b) => ORDER[a.fit] - ORDER[b.fit] || byName(a, b));
}
