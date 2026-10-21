// Pure rules for the attendance roll shared by admin Attendance and the tutor
// lesson page, so "All present" and the tally read the same in both roles.

export const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present", tone: "text-good" },
  { value: "late", label: "Late", tone: "text-warn" },
  { value: "left_early", label: "Left early", tone: "text-warn" },
  { value: "absent", label: "Absent", tone: "text-bad" },
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_OPTIONS)[number]["value"];

/** The marks a roll can save: a make-up student is marked like the class. */
export const ROLL_STATUSES = ATTENDANCE_OPTIONS.map((o) => o.value) as [AttendanceStatus, ...AttendanceStatus[]];

/**
 * A saved mark as the roll shows it. "Make-up attended" is no longer a mark
 * (migration 0084 made every one "present"); read one as Present.
 */
export function rollStatusOf(status: string | null | undefined): AttendanceStatus | null {
  if (status === "makeup_attended") return "present";
  return (ROLL_STATUSES as readonly string[]).includes(status ?? "") ? (status as AttendanceStatus) : null;
}

export type RollStatuses = Record<string, AttendanceStatus | null>;

type RollMember = { id: string; movedOutTo?: string; tookCredit?: boolean };

/** Away from this lesson: moved to another, or cancelled for a credit. */
function isAway(s: RollMember): boolean {
  return Boolean(s.movedOutTo || s.tookCredit);
}

/**
 * "All present" marks everyone here, make-up students included; students
 * who moved to another lesson or cancelled it for a credit keep the absence
 * written then.
 */
export function markAllPresent(students: RollMember[], statuses: RollStatuses): RollStatuses {
  const next = { ...statuses };
  for (const s of students) {
    if (!isAway(s)) next[s.id] = "present";
  }
  return next;
}

export function canMarkAllPresent(students: RollMember[]): boolean {
  return students.some((s) => !isAway(s));
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
