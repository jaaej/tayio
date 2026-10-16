import { formatTimeRange } from "@/lib/format";

/** The parts of a class card a family notices. Times are HH:MM or HH:MM:SS. */
export type CardSlot = {
  weekday: number | null;
  startTime: string;
  endTime: string;
  room: string;
  tutorId: string;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const time = (t: string) => t.slice(0, 5);
const room = (r: string) => r.trim();

function slotLabel(s: CardSlot) {
  return s.weekday === null || !s.startTime || !s.endTime
    ? "no weekly time"
    : `${WEEKDAYS[s.weekday]} ${formatTimeRange(s.startTime, s.endTime)}`;
}

function plural(n: number, one: string) {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

/** "Tom Tutor, 6 students and 5 parents" with only the non-zero groups. */
function listOf(names: string[]) {
  return names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The note under a class card once a saved class's day, time, room or tutor
 * is edited: what changed and who saving will tell. Null when nothing a
 * family or tutor would notice has changed.
 */
export function changeNotice(
  saved: CardSlot,
  current: CardSlot,
  people: { tutorName: string; oldTutorName: string; students: number; parents: number },
): string | null {
  const when =
    saved.weekday !== current.weekday ||
    time(saved.startTime) !== time(current.startTime) ||
    time(saved.endTime) !== time(current.endTime);
  const roomChanged = room(saved.room) !== room(current.room);
  const tutorChanged = saved.tutorId !== current.tutorId;
  if (!when && !roomChanged && !tutorChanged) return null;

  const told = [
    people.tutorName,
    ...(tutorChanged && people.oldTutorName !== people.tutorName ? [people.oldTutorName] : []),
  ];
  if (when || roomChanged) {
    if (people.students > 0) told.push(plural(people.students, "student"));
    if (people.parents > 0) told.push(plural(people.parents, "parent"));
  }
  const tells = `Saving tells ${listOf(told)}.`;

  if (when && roomChanged) {
    const was = [slotLabel(saved), room(saved.room)].filter(Boolean).join(", ");
    return `Time and room changed from ${was}. ${tells}`;
  }
  if (when) return `Time changed from ${slotLabel(saved)}. ${tells}`;
  if (roomChanged) {
    if (!room(saved.room)) return `Room set to ${room(current.room)}. ${tells}`;
    if (!room(current.room)) return `Room cleared (was ${room(saved.room)}). ${tells}`;
    return `Room changed from ${room(saved.room)}. ${tells}`;
  }
  return `Tutor changed from ${people.oldTutorName}. ${tells}`;
}

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * True when another class uses `name` at a time overlapping this card's day
 * and time. "Online" is never taken. A warning only: it can still be chosen.
 */
export function roomTaken(
  name: string,
  slot: Pick<CardSlot, "weekday" | "startTime" | "endTime">,
  others: { weekday: number | null; startTime: string | null; endTime: string | null; room: string | null }[],
): boolean {
  const key = name.trim().toLowerCase();
  if (!key || key === "online") return false;
  if (slot.weekday === null || !slot.startTime || !slot.endTime) return false;
  const start = minutes(slot.startTime);
  const end = minutes(slot.endTime);
  return others.some(
    (o) =>
      o.weekday === slot.weekday &&
      o.startTime &&
      o.endTime &&
      o.room?.trim().toLowerCase() === key &&
      minutes(o.startTime) < end &&
      start < minutes(o.endTime),
  );
}
