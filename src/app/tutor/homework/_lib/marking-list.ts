// Pure rules for the tutor Marking split view: the queue order, grouping,
// search, the "Save & next" target and the URL contract. Kept free of server
// imports so the client list pane and the server detail page share them.

export type MarkingView = "to-mark" | "marked" | "homework";

export const MARKING_VIEWS: { value: MarkingView; label: string }[] = [
  { value: "to-mark", label: "To mark" },
  { value: "marked", label: "Marked" },
  { value: "homework", label: "All homework" },
];

export function parseMarkingView(value: string | null | undefined): MarkingView {
  return value === "marked" || value === "homework" ? value : "to-mark";
}

export type SubmissionItem = {
  homeworkId: string;
  studentId: string;
  homeworkTitle: string;
  studentName: string;
  subjectName: string | null;
  subjectColor: string | null;
  classLabel: string | null;
  status: string;
  /** ISO timestamps, so the list can cross the server/client boundary. */
  submittedAt: string | null;
  markedAt: string | null;
};

export type HomeworkItem = {
  id: string;
  title: string;
  subjectName: string | null;
  subjectColor: string | null;
  classLabel: string | null;
  dueDate: string;
  toMark: number;
  marked: number;
  total: number;
};

/** Late work first (it has waited longest), then oldest submission first. */
export function sortToMark<T extends Pick<SubmissionItem, "status" | "submittedAt" | "studentName">>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const lateA = a.status === "late" ? 0 : 1;
    const lateB = b.status === "late" ? 0 : 1;
    if (lateA !== lateB) return lateA - lateB;
    const at = a.submittedAt ?? "";
    const bt = b.submittedAt ?? "";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.studentName.localeCompare(b.studentName);
  });
}

export function groupToMark<T extends Pick<SubmissionItem, "status">>(
  sorted: T[],
): { key: "late" | "submitted"; items: T[] }[] {
  const late = sorted.filter((i) => i.status === "late");
  const submitted = sorted.filter((i) => i.status !== "late");
  return [
    ...(late.length ? [{ key: "late" as const, items: late }] : []),
    ...(submitted.length ? [{ key: "submitted" as const, items: submitted }] : []),
  ];
}

/** Case-insensitive match on student, homework, class or subject. */
export function matchesQuery(
  fields: (string | null | undefined)[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

export const submissionKey = (homeworkId: string, studentId: string) =>
  `${homeworkId}:${studentId}`;

/**
 * Where "Save & next" goes: the item after the current one in the to-mark
 * order, wrapping to the first, or null when nothing else is waiting. When
 * the current item is not in the queue (re-marking), it is the first item.
 */
export function nextToMark<T extends Pick<SubmissionItem, "homeworkId" | "studentId">>(
  sorted: T[],
  current: { homeworkId: string; studentId: string },
): T | null {
  const key = submissionKey(current.homeworkId, current.studentId);
  const index = sorted.findIndex((i) => submissionKey(i.homeworkId, i.studentId) === key);
  const rest = index === -1 ? sorted : [...sorted.slice(index + 1), ...sorted.slice(0, index)];
  return rest[0] ?? null;
}

/** A submission's URL, carrying the list's view and search along. */
export function submissionHref(
  homeworkId: string,
  studentId: string,
  list: { view?: MarkingView; q?: string },
): string {
  const params = new URLSearchParams({ student: studentId });
  if (list.view && list.view !== "to-mark") params.set("view", list.view);
  if (list.q) params.set("q", list.q);
  return `/tutor/homework/${homeworkId}?${params.toString()}`;
}

export function listHref(path: string, list: { view?: MarkingView; q?: string }): string {
  const params = new URLSearchParams();
  if (list.view && list.view !== "to-mark") params.set("view", list.view);
  if (list.q) params.set("q", list.q);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
