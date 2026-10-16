/** Rooms in use, each once, in natural order (Room 2 before Room 10). */
export function roomsInUse(locations: (string | null)[]): string[] {
  const rooms = new Set(
    locations.map((l) => l?.trim()).filter((l): l is string => Boolean(l)),
  );
  return [...rooms].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
