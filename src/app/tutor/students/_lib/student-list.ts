/*
 * Pure list logic for the /tutor/students split view. Shared by the server
 * layout (which shapes rows), the client list pane (which filters them from
 * the URL) and the profile, and unit-tested on its own.
 */

export type FlagTone = "bad" | "warn" | "info" | "good";

export type StudentFlag = { label: string; tone: FlagTone };

export type StudentListRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarKey: string | null;
  /** Secondary line under the name, e.g. "75% attendance · 1 overdue". */
  sub: string;
  flag: StudentFlag | null;
};

export type StudentListGroup = {
  classId: string;
  /** Display name of the class ("Year 9 Maths"). */
  label: string;
  subjectName: string;
  /** Normalised subject year key, for the year filter. */
  yearKey: string | null;
  students: StudentListRow[];
};

/** The params that describe the list, carried on every row and tab link so
 *  opening a student never resets the list the tutor was looking at. */
export const LIST_PARAM_KEYS = ["q", "year"] as const;

/** Same definition as the admin profile facts: arriving late or leaving
 *  early still counts as attending. */
export const ATTENDED_STATUSES = [
  "present",
  "late",
  "left_early",
  "makeup_attended",
] as const;

/** How many recent marked lessons the attendance figure looks back over. */
export const RECENT_LESSONS = 8;

export type AttendanceSummary = {
  attended: number;
  total: number;
  percent: number | null;
};

export function attendanceSummary(statuses: readonly string[]): AttendanceSummary {
  const total = statuses.length;
  const attended = statuses.filter((s) =>
    (ATTENDED_STATUSES as readonly string[]).includes(s),
  ).length;
  return {
    attended,
    total,
    percent: total === 0 ? null : Math.round((attended / total) * 100),
  };
}

export type HomeworkState = "marked" | "to_mark" | "overdue" | "due_today" | "open";

export const HOMEWORK_STATE: Record<HomeworkState, { label: string; tone: FlagTone | "default" }> = {
  marked: { label: "Marked", tone: "good" },
  to_mark: { label: "To mark", tone: "warn" },
  overdue: { label: "Overdue", tone: "bad" },
  due_today: { label: "Due today", tone: "warn" },
  open: { label: "Not handed in", tone: "default" },
};

/**
 * Where a piece of homework stands for the tutor. `submitted` and `late` are
 * handed-in work waiting for marking (the marking queue's definition); the
 * not-handed-in statuses become overdue once the due date (a Melbourne
 * calendar date) has passed.
 */
export function homeworkState(
  status: string,
  dueDate: string,
  today: string,
): HomeworkState {
  if (status === "marked" || status === "returned") return "marked";
  if (status === "submitted" || status === "late") return "to_mark";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  return "open";
}

/**
 * One flag per row, the most useful first: leave explains an absence before
 * anything else, then work that is late, then work due today, then a trial.
 */
export function studentFlag(signals: {
  onLeave: boolean;
  overdue: number;
  dueToday: number;
  trial: boolean;
}): StudentFlag | null {
  if (signals.onLeave) return { label: "On leave", tone: "info" };
  if (signals.overdue > 0) return { label: "Overdue", tone: "bad" };
  if (signals.dueToday > 0) return { label: "Due today", tone: "warn" };
  if (signals.trial) return { label: "Trial", tone: "good" };
  return null;
}

export function studentSubLine(
  attendance: AttendanceSummary,
  overdue: number,
  trial: boolean,
): string {
  const parts: string[] = [];
  if (attendance.percent !== null) parts.push(`${attendance.percent}% attendance`);
  else parts.push(trial ? "Free trial" : "No lessons marked yet");
  if (overdue > 0) parts.push(`${overdue} overdue`);
  return parts.join(" · ");
}

/**
 * Filters the groups by the search box (name or email) and the year filter.
 * Groups left with no students are dropped, so the list never shows a bare
 * class heading.
 */
export function filterGroups(
  groups: StudentListGroup[],
  query: string,
  yearKey: string | null,
): StudentListGroup[] {
  const q = query.trim().toLowerCase();
  return groups
    .filter((g) => !yearKey || g.yearKey === yearKey)
    .map((g) => ({
      ...g,
      students: q
        ? g.students.filter(
            (s) =>
              `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
              s.email.toLowerCase().includes(q),
          )
        : g.students,
    }))
    .filter((g) => g.students.length > 0);
}

/** Stable key for a subject's year level ("Year 9", "year 9" -> "year-9"). */
export function yearKeyOf(yearLevel: string | null | undefined): string | null {
  const value = (yearLevel ?? "").trim().replace(/\s+/g, " ");
  if (!value) return null;
  const numeric = /^(?:(?:year|yr|y)\.?\s*)?(\d{1,2})$/i.exec(value);
  return numeric ? `year-${Number(numeric[1])}` : value.toLowerCase();
}

/**
 * Year filter options, youngest first with named levels (VCE) after the
 * numbered ones. Only worth showing when the tutor teaches 2+ year levels.
 */
export function yearOptions(
  levels: Array<string | null>,
): Array<{ key: string; label: string }> {
  const byKey = new Map<string, string>();
  for (const level of levels) {
    const key = yearKeyOf(level);
    if (key && !byKey.has(key)) {
      const n = /^year-(\d+)$/.exec(key);
      byKey.set(key, n ? `Year ${n[1]}` : (level ?? "").trim());
    }
  }
  const rank = (key: string) => {
    const n = /^year-(\d+)$/.exec(key);
    return n ? Number(n[1]) : 100;
  };
  return Array.from(byKey, ([key, label]) => ({ key, label })).sort(
    (a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label),
  );
}

/** Distinct students across the groups (a student can sit in two classes). */
export function distinctStudentCount(groups: StudentListGroup[]): number {
  return new Set(groups.flatMap((g) => g.students.map((s) => s.id))).size;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

/** `path` plus the list params of `source`, then any extra params. */
export function withListQuery(
  path: string,
  source: ParamSource,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  for (const key of LIST_PARAM_KEYS) {
    const value = readParam(source, key);
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
