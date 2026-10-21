/**
 * The roll rule behind `lessonRollIds`: the class's students (never on a
 * make-up lesson, a private booking that only points at a class), anyone
 * booked onto the lesson (`lessonGuestIdsSql`: a reschedule, a credit, an
 * admin's one-off visit), and anyone with attendance on it.
 */
export function rollMemberIds(
  status: string,
  sources: { classRoster: string[]; booked: string[]; marked: string[] },
): Set<string> {
  return new Set([
    ...(status === "makeup" ? [] : sources.classRoster),
    ...sources.booked,
    ...sources.marked,
  ]);
}

type ReasonRow = { studentId: string; reason: string | null };

/**
 * Each student's reason for moving into or out of a lesson, read from where
 * it is kept (never the roll note): a reschedule out of the lesson, else a
 * cancellation, else the credit asked for instead, else a reschedule into
 * it. Blank reasons are left out.
 */
export function moveReasons(sources: {
  movedOut: ReasonRow[];
  cancelled: ReasonRow[];
  credited: ReasonRow[];
  movedIn: ReasonRow[];
}): Map<string, string> {
  const reasons = new Map<string, string>();
  for (const rows of [sources.movedOut, sources.cancelled, sources.credited, sources.movedIn]) {
    for (const row of rows) {
      const reason = row.reason?.trim();
      if (reason && !reasons.has(row.studentId)) reasons.set(row.studentId, reason);
    }
  }
  return reasons;
}
