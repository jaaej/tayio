/**
 * One attendance rule for every role: what counts as attending, and which
 * absences are really moves. An approved reschedule or a cancellation with a
 * credit marks the original lesson `absent`, but the student did not miss
 * it (they moved it, or will make it up), so it is left out of every rate
 * and reads "Moved". `attendanceMovedSql` (server) works out `moved`.
 */

export type AttendanceStatus = "present" | "absent" | "late" | "left_early" | "makeup_attended";

/** Arriving late or leaving early still counts as attending. */
export const ATTENDED_STATUSES = ["present", "late", "left_early", "makeup_attended"] as const;

export type AttendanceMark = { status: string; moved?: boolean | null };

export function isAttended(status: string): boolean {
  return (ATTENDED_STATUSES as readonly string[]).includes(status);
}

/** An absence written by a reschedule or a credit cancellation. */
export function isMovedAbsence(mark: AttendanceMark): boolean {
  return mark.status === "absent" && Boolean(mark.moved);
}

export type AttendanceSummary = {
  attended: number;
  /** Real absences (moved lessons are not absences). */
  absent: number;
  /** Lessons that count: everything marked except moved lessons. */
  total: number;
  percent: number | null;
};

export function attendanceSummary(marks: readonly AttendanceMark[]): AttendanceSummary {
  const counted = marks.filter((m) => !isMovedAbsence(m));
  const attended = counted.filter((m) => isAttended(m.status)).length;
  return {
    attended,
    absent: counted.length - attended,
    total: counted.length,
    percent: counted.length === 0 ? null : Math.round((attended / counted.length) * 100),
  };
}

/** The label for one marked lesson: a moved absence reads "Moved". */
export function attendanceLabel(mark: AttendanceMark): string {
  if (isMovedAbsence(mark)) return "Moved";
  return ATTENDANCE_LABELS[mark.status] ?? mark.status;
}

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  left_early: "Left early",
  makeup_attended: "Make-up attended",
};
