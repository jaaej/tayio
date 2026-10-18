/*
 * Pure rules for the tutor's student profile (/tutor/students/[id]):
 * attendance and homework summaries and the URL contract. Unit-tested on
 * its own.
 */

export type FlagTone = "bad" | "warn" | "info" | "good";

/** The params carried on every tab link: `class` is the roster the profile
 *  was opened from, so its back button keeps returning there. */
export const LIST_PARAM_KEYS = ["class"] as const;

/** How many recent marked lessons the attendance figure looks back over. */
export const RECENT_LESSONS = 8;

// The attendance and homework rules are shared by every role.
export { attendanceSummary, type AttendanceSummary } from "@/lib/attendance-rules";
export { homeworkState, type HomeworkState } from "@/lib/homework-rules";
import { HOMEWORK_STATE_LABEL, type HomeworkState } from "@/lib/homework-rules";

export const HOMEWORK_STATE: Record<HomeworkState, { label: string; tone: FlagTone | "default" }> = {
  marked: { label: HOMEWORK_STATE_LABEL.marked, tone: "good" },
  to_mark: { label: HOMEWORK_STATE_LABEL.to_mark, tone: "warn" },
  overdue: { label: HOMEWORK_STATE_LABEL.overdue, tone: "bad" },
  due_today: { label: HOMEWORK_STATE_LABEL.due_today, tone: "warn" },
  open: { label: HOMEWORK_STATE_LABEL.open, tone: "default" },
};

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
