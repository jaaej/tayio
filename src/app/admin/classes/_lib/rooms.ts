/** Rooms in use, each once, in natural order (Room 2 before Room 10). */
export function roomsInUse(locations: (string | null)[]): string[] {
  const rooms = new Set(
    locations.map((l) => l?.trim()).filter((l): l is string => Boolean(l)),
  );
  return [...rooms].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/** The rooms to offer for a class: the rooms in use, then "Online". */
export function roomChoices(locations: (string | null)[]): string[] {
  return [...roomsInUse(locations).filter((r) => r.toLowerCase() !== "online"), "Online"];
}

/** A weekly time a room is used, or would be. Times are HH:MM or HH:MM:SS. */
export type RoomSlot = { weekday: number | null; startTime: string | null; endTime: string | null };

/** A weekly class's slot and its room. */
export type RoomUse = RoomSlot & { room: string | null };

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * True when another class uses `name` at a time overlapping `slot`'s day and
 * time. "Online" is never taken. The Room list disables a taken room.
 */
export function roomTaken(
  name: string,
  slot: RoomSlot,
  others: RoomUse[],
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
