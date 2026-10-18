/**
 * The roll rule behind `lessonRollIds`: the class's students (never on a
 * make-up lesson, a private booking that only points at a class), anyone
 * rescheduled into the lesson, and anyone with attendance on it.
 */
export function rollMemberIds(
  status: string,
  sources: { classRoster: string[]; movedIn: string[]; marked: string[] },
): Set<string> {
  return new Set([
    ...(status === "makeup" ? [] : sources.classRoster),
    ...sources.movedIn,
    ...sources.marked,
  ]);
}
