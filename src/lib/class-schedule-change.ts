import { formatDateShort, formatTimeRange, formatWeekday } from "@/lib/format";
import { addIsoDays, weekStartForIsoDate } from "@/lib/tutor-checkin-rules";
import { lessonStartInstant } from "@/lib/tutor-cover-rules";

/** The weekly-slot fields of a class, before or after an admin edit. */
export type ClassSlot = {
  tutorId: string;
  isRecurring: boolean;
  /** JS weekday, Sunday = 0. */
  weekday: number | null;
  /** HH:MM or HH:MM:SS. */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};

/**
 * An upcoming lesson the weekly slot made: status `upcoming`, not created by
 * a reschedule, and not started yet.
 */
export type SlotLesson = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  tutorId: string;
  location: string | null;
  /** Something points at this lesson (a booking, cover, cancellation, ...),
   *  so it is never deleted. */
  hasDependents: boolean;
};

export type LessonChange = Partial<
  Pick<SlotLesson, "date" | "startTime" | "endTime" | "tutorId" | "location">
>;

export type ScheduleChangePlan = {
  updates: { id: string; set: LessonChange }[];
  deletes: string[];
};

/** "16:00" and "16:00:00" are the same time. */
function fullTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

/** Blank and missing rooms are the same. */
function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function weeklySlot(slot: ClassSlot) {
  if (!slot.isRecurring || slot.weekday === null || !slot.startTime || !slot.endTime) {
    return null;
  }
  return {
    weekday: slot.weekday,
    startTime: fullTime(slot.startTime),
    endTime: fullTime(slot.endTime),
  };
}

/** What changed for the people in the class. */
export function slotChangeSummary(before: ClassSlot, after: ClassSlot) {
  const a = weeklySlot(before);
  const b = weeklySlot(after);
  return {
    when:
      a?.weekday !== b?.weekday ||
      a?.startTime !== b?.startTime ||
      a?.endTime !== b?.endTime,
    room: clean(before.location) !== clean(after.location),
    tutor: before.tutorId !== after.tutorId,
  };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_NAME = /^(.*?)\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday) (am|pm)$/i;

/**
 * The "<Day> AM|PM" name a class gets from its slot ("Thursday PM"), or null
 * without a weekly slot. A current name ending that way keeps what comes
 * before ("Year 9 Maths · Thursday PM" becomes "Year 9 Maths · Wednesday
 * PM"); any other custom name is kept as it is (null).
 */
export function slotClassName(slot: ClassSlot, current = ""): string | null {
  const s = weeklySlot(slot);
  if (!s) return null;
  const hour = Number(s.startTime.slice(0, 2));
  const dayName = `${WEEKDAYS[s.weekday]} ${hour < 12 ? "AM" : "PM"}`;
  if (!current.trim()) return dayName;
  const match = current.trim().match(DAY_NAME);
  return match ? `${match[1]}${dayName}` : null;
}

/** "Tuesday · 5 - 6 pm", or "No weekly time". */
export function weeklySlotLabel(slot: ClassSlot): string {
  const s = weeklySlot(slot);
  if (!s) return "No weekly time";
  return `${WEEKDAYS[s.weekday]} · ${formatTimeRange(s.startTime, s.endTime)}`;
}

/** Notification title naming what changed: "Class time and room changed". */
export function classChangeTitle(change: ReturnType<typeof slotChangeSummary>): string {
  const parts = [
    change.when && "time",
    change.room && "room",
    change.tutor && "tutor",
  ].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return "Class updated";
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Class ${list} changed`;
}

/**
 * The notification sentence for a moved class: "Year 9 Maths moves to Room 3
 * from Thu 22 Oct." `fromIso` is the first lesson on the new slot.
 */
export function classMoveSentence(
  className: string,
  after: ClassSlot,
  change: ReturnType<typeof slotChangeSummary>,
  fromIso: string | null,
): string {
  const slot = weeklySlot(after);
  const room = clean(after.location);
  const from = fromIso ? ` from ${formatWeekday(fromIso, "short")} ${formatDateShort(fromIso)}` : "";
  if (change.when && !slot) return `${className} no longer has a weekly time.`;
  const when = slot
    ? `${WEEKDAYS[slot.weekday]} ${formatTimeRange(slot.startTime, slot.endTime)}`
    : null;
  if (change.when && change.room) {
    return room
      ? `${className} moves to ${when} in ${room}${from}.`
      : `${className} moves to ${when}, with no set room${from}.`;
  }
  if (change.when) return `${className} moves to ${when}${from}.`;
  return room
    ? `${className} moves to ${room}${from}.`
    : `${className} has no set room${from}.`;
}

/**
 * How an admin's edit to a class reaches its upcoming lessons.
 *
 * Every lesson moves to the new day in its own Monday-first week, at the new
 * time. One that would land in the past is removed, unless something points
 * at it (then it stays where it is). A week holding two weekly lessons (left
 * by an edit before this rule existed) keeps one. When the class stops
 * repeating, its weekly lessons go, except ones something points at.
 *
 * The tutor and room follow the class unless a lesson was given its own (a
 * cover tutor, a different room).
 */
export function planClassScheduleChange({
  before,
  after,
  lessons,
  now,
}: {
  before: ClassSlot;
  after: ClassSlot;
  lessons: SlotLesson[];
  now: Date;
}): ScheduleChangePlan {
  const slot = weeklySlot(after);
  const deletes: string[] = [];
  const moves = new Map<string, LessonChange>();

  const old = weeklySlot(before);
  // A lesson on the old weekly slot is the real one; anything else in its
  // week is left over from an earlier edit.
  const onOldSlot = (l: SlotLesson) =>
    old !== null &&
    new Date(`${l.date}T00:00:00Z`).getUTCDay() === old.weekday &&
    fullTime(l.startTime) === old.startTime &&
    fullTime(l.endTime) === old.endTime;

  if (!slot) {
    for (const l of lessons) if (!l.hasDependents) deletes.push(l.id);
  } else {
    const weeks = new Map<string, SlotLesson[]>();
    for (const l of lessons) {
      const week = weekStartForIsoDate(l.date);
      weeks.set(week, [...(weeks.get(week) ?? []), l]);
    }
    for (const [week, group] of weeks) {
      const date = addIsoDays(week, (slot.weekday + 6) % 7);
      const inSlot = (l: SlotLesson) =>
        l.date === date &&
        fullTime(l.startTime) === slot.startTime &&
        fullTime(l.endTime) === slot.endTime;
      const keeper =
        group.find((l) => l.hasDependents) ??
        group.find(inSlot) ??
        group.find(onOldSlot) ??
        group[0];
      for (const l of group) {
        if (l !== keeper && !l.hasDependents) deletes.push(l.id);
      }
      if (lessonStartInstant(date, slot.startTime) <= now) {
        if (!keeper.hasDependents) deletes.push(keeper.id);
        continue;
      }
      const set: LessonChange = {};
      if (keeper.date !== date) set.date = date;
      if (fullTime(keeper.startTime) !== slot.startTime) set.startTime = slot.startTime;
      if (fullTime(keeper.endTime) !== slot.endTime) set.endTime = slot.endTime;
      moves.set(keeper.id, set);
    }
  }

  const removed = new Set(deletes);
  const updates: ScheduleChangePlan["updates"] = [];
  for (const l of lessons) {
    if (removed.has(l.id)) continue;
    const set: LessonChange = { ...moves.get(l.id) };
    if (before.tutorId !== after.tutorId && l.tutorId === before.tutorId) {
      set.tutorId = after.tutorId;
    }
    if (
      clean(before.location) !== clean(after.location) &&
      clean(l.location) === clean(before.location)
    ) {
      set.location = clean(after.location);
    }
    if (Object.keys(set).length > 0) updates.push({ id: l.id, set });
  }

  return {
    updates,
    deletes: lessons.filter((l) => removed.has(l.id)).map((l) => l.id),
  };
}
