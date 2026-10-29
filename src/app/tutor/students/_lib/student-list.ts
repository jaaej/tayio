/*
 * Pure rules for the tutor's student profile (/tutor/students/[id]): the URL
 * contract (where the back button goes, which params every tab link keeps).
 * The record itself (lessons, homework, key numbers) is the shared
 * `@/lib/student-history`. Unit-tested on its own.
 */

/** The params carried on every tab link, so the back button keeps
 *  returning to where the profile was opened from (`profileBack`). */
export const LIST_PARAM_KEYS = ["class", "from", "homework", "lesson", "view"] as const;

import { parseMarkingView, submissionHref } from "@/app/tutor/homework/_lib/marking-list";

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidParam = (source: ParamSource, key: string) => {
  const value = readParam(source, key);
  return value && UUID_RE.test(value) ? value : null;
};

/**
 * Where the profile's back button goes, from the params the opening link
 * set: a class roster (`class`), the submission being marked
 * (`from=marking&homework=`, with the Marking `view`), a lesson
 * (`from=lesson&lesson=`) or Today (`from=today`). Anything else, a search
 * or a message, goes to Classes, where the tutor's students live.
 */
export function profileBack(studentId: string, source: ParamSource): { href: string; label: string } {
  const from = readParam(source, "from");
  const classId = uuidParam(source, "class");
  const homeworkId = uuidParam(source, "homework");
  const lessonId = uuidParam(source, "lesson");
  if (classId) return { href: `/tutor/classes/${classId}/students`, label: "Back to class" };
  if (from === "marking" && homeworkId) {
    return {
      href: submissionHref(homeworkId, studentId, { view: parseMarkingView(readParam(source, "view")) }),
      label: "Back to marking",
    };
  }
  if (from === "lesson" && lessonId) return { href: `/tutor/lessons/${lessonId}`, label: "Back to lesson" };
  if (from === "today") return { href: "/tutor", label: "Back to Today" };
  return { href: "/tutor/classes", label: "Classes" };
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
