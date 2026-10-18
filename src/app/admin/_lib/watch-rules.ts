import { attendanceSummary, type AttendanceMark } from "@/lib/attendance-rules";

/*
 * Pure rules for "Students to watch" (admin dashboard) and the matching row
 * flags in the user directory. `watch-signals.ts` loads the rows.
 */

/** How many of a student's latest counted lessons the absence check reads. */
export const RECENT_MARKS = 4;
/** Absences, or overdue homework tasks, that put a student on the list. */
export const WATCH_THRESHOLD = 2;

export type WatchSignals = {
  /** Students with 2+ absences in their last four counted lessons. */
  absences: Map<string, { absent: number; counted: number }>;
  /** Students with 2+ overdue homework tasks, and how many. */
  overdueHomework: Map<string, number>;
};

/**
 * `marks` are each student's latest counted marks (moved lessons already left
 * out, at most RECENT_MARKS each); `overdueStudentIds` has one entry per
 * overdue homework task.
 */
export function watchSignalsFrom(
  marks: readonly (AttendanceMark & { studentId: string })[],
  overdueStudentIds: readonly string[],
): WatchSignals {
  const byStudent = new Map<string, AttendanceMark[]>();
  for (const mark of marks) {
    const list = byStudent.get(mark.studentId) ?? [];
    list.push(mark);
    byStudent.set(mark.studentId, list);
  }
  const absences = new Map<string, { absent: number; counted: number }>();
  for (const [studentId, list] of byStudent) {
    const summary = attendanceSummary(list.slice(0, RECENT_MARKS));
    if (summary.absent >= WATCH_THRESHOLD) {
      absences.set(studentId, { absent: summary.absent, counted: summary.total });
    }
  }

  const homeworkCounts = new Map<string, number>();
  for (const id of overdueStudentIds) homeworkCounts.set(id, (homeworkCounts.get(id) ?? 0) + 1);
  const overdueHomework = new Map(
    [...homeworkCounts].filter(([, count]) => count >= WATCH_THRESHOLD),
  );

  return { absences, overdueHomework };
}

export type WatchReason = {
  reason: string;
  tone: "bad" | "warn";
  /** The part of the student's history the reason is about. */
  section: "attendance" | "homework";
};

/**
 * Students to watch, most urgent first: absences rank above homework because
 * they are the earlier sign of a family drifting away.
 */
export function rankWatchList(
  signals: WatchSignals,
  limit: number,
): { studentId: string; why: WatchReason }[] {
  const absent = [...signals.absences]
    .sort((a, b) => b[1].absent - a[1].absent)
    .map(([studentId, a]) => ({
      studentId,
      why: {
        reason: `Missed ${a.absent} of last ${a.counted} lessons`,
        tone: "bad" as const,
        section: "attendance" as const,
      },
    }));
  const homework = [...signals.overdueHomework]
    .filter(([studentId]) => !signals.absences.has(studentId))
    .sort((a, b) => b[1] - a[1])
    .map(([studentId, count]) => ({
      studentId,
      why: {
        reason: `${count} homework tasks overdue`,
        tone: "warn" as const,
        section: "homework" as const,
      },
    }));
  return [...absent, ...homework].slice(0, limit);
}
