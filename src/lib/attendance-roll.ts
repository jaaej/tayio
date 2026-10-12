// Pure rules for the attendance roll shared by admin Attendance and the tutor
// lesson page, so "All present" and the tally read the same in both roles.

export const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present", tone: "text-good" },
  { value: "late", label: "Late", tone: "text-warn" },
  { value: "left_early", label: "Left early", tone: "text-warn" },
  { value: "absent", label: "Absent", tone: "text-bad" },
  { value: "makeup_attended", label: "Make-up", tone: "text-info" },
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_OPTIONS)[number]["value"];

export type RollStatuses = Record<string, AttendanceStatus | null>;

type RollMember = { id: string; movedOutTo?: string; makeupFrom?: string };

/**
 * Students who moved to another lesson keep the absence written when they
 * were moved, and make-up attendees default to "Make-up"; "All present" only
 * fills in the class that is actually here.
 */
export function markAllPresent(students: RollMember[], statuses: RollStatuses): RollStatuses {
  const next = { ...statuses };
  for (const s of students) {
    if (!s.movedOutTo && !s.makeupFrom) next[s.id] = "present";
  }
  return next;
}

export function canMarkAllPresent(students: RollMember[]): boolean {
  return students.some((s) => !s.movedOutTo && !s.makeupFrom);
}

/** "5 present · 1 late · 2 not marked", in option order. */
export function rollSummary(students: { id: string }[], statuses: RollStatuses): string {
  const parts = ATTENDANCE_OPTIONS.map((opt) => ({
    label: opt.label.toLowerCase(),
    count: students.filter((s) => statuses[s.id] === opt.value).length,
  }))
    .filter((t) => t.count > 0)
    .map((t) => `${t.count} ${t.label}`);
  const unmarked = students.filter((s) => !statuses[s.id]).length;
  if (unmarked > 0) parts.push(`${unmarked} not marked`);
  return parts.join(" · ");
}
