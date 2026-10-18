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
