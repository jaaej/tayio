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

export type DeliveryMode = "in_person" | "online";

/** A class card's fields beyond its slot (the old class page's details). */
export type CardDetails = {
  name: string;
  subjectId: string;
  classType: "group" | "one_on_one";
  capacity: number;
  onlineLink: string;
};

/** A student on a class card, saved or staged for the next save. */
export type CardStudent = {
  id: string;
  name: string;
  /** "Glen Waverley SC · noah@taiyo.com" or just the email. */
  detail: string;
  /** The saved enrolment; null for a student added on this page. */
  saved: { deliveryMode: DeliveryMode | null; adminNotes: string } | null;
  deliveryMode: DeliveryMode | null;
  adminNotes: string;
  /** Marked to leave the class when the page is saved. */
  leaving: boolean;
};

/**
 * The detail fields to send for a card: the changed ones for a saved class,
 * everything set for a new one. A blank name or link on a new class is left
 * out, so the class is named from its slot and has no link.
 */
export function detailsPatch(saved: CardDetails | null, current: CardDetails): Partial<CardDetails> {
  const name = current.name.trim();
  const link = current.onlineLink.trim();
  if (!saved) {
    return {
      ...(name && { name }),
      subjectId: current.subjectId,
      classType: current.classType,
      capacity: current.capacity,
      ...(link && { onlineLink: link }),
    };
  }
  return {
    ...(name && name !== saved.name.trim() && { name }),
    ...(current.subjectId !== saved.subjectId && { subjectId: current.subjectId }),
    ...(current.classType !== saved.classType && { classType: current.classType }),
    ...(current.capacity !== saved.capacity && { capacity: current.capacity }),
    ...(link !== saved.onlineLink.trim() && { onlineLink: link }),
  };
}

export type StudentChanges = {
  add: string[];
  withdraw: string[];
  updates: { studentId: string; deliveryMode?: DeliveryMode | null; adminNotes?: string }[];
};

/**
 * What saving does to a card's students: who joins, who leaves, and whose
 * delivery mode or private note changes. A student added and removed again
 * before saving is simply left out.
 */
export function studentChanges(students: CardStudent[]): StudentChanges {
  const add: string[] = [];
  const withdraw: string[] = [];
  const updates: StudentChanges["updates"] = [];
  for (const s of students) {
    if (s.leaving) {
      if (s.saved) withdraw.push(s.id);
      continue;
    }
    if (!s.saved) add.push(s.id);
    const was = s.saved ?? { deliveryMode: null, adminNotes: "" };
    const update: StudentChanges["updates"][number] = { studentId: s.id };
    if (s.deliveryMode !== was.deliveryMode) update.deliveryMode = s.deliveryMode;
    if (s.adminNotes.trim() !== was.adminNotes.trim()) update.adminNotes = s.adminNotes.trim();
    if (Object.keys(update).length > 1) updates.push(update);
  }
  return { add, withdraw, updates };
}

export function hasStudentChanges(changes: StudentChanges): boolean {
  return changes.add.length > 0 || changes.withdraw.length > 0 || changes.updates.length > 0;
}
