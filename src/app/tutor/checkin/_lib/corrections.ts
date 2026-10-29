import { formatTime, formatTimeRange, formatWeekday } from "@/lib/format";

/*
 * What admin changed in a tutor's week, in words, for the check-in footer.
 * A corrected entry keeps only the corrected times, so the lesson's own
 * schedule is the "before".
 */

export type CorrectableEntry = {
  lessonId: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  note: string | null;
  isManualOverride: boolean;
  isRemoved: boolean;
};

export type ScheduledLesson = { date: string; startTime: string; endTime: string };

const hhmm = (time: string) => time.slice(0, 5);

/** One sentence per corrected or removed entry, in the entries' order. */
export function correctionLines(
  entries: readonly CorrectableEntry[],
  scheduled: ReadonlyMap<string, ScheduledLesson>,
): string[] {
  const perDay = new Map<string, number>();
  for (const e of entries) perDay.set(e.workDate, (perDay.get(e.workDate) ?? 0) + 1);

  return entries
    .filter((e) => e.isManualOverride || e.isRemoved)
    .map((e) => {
      const day = formatWeekday(e.workDate, "long");
      // Name the lesson only when the day has more than one.
      const whose = (perDay.get(e.workDate) ?? 0) > 1 ? `${day}'s ${e.subjectName}` : `${day}'s`;
      const lesson = e.lessonId ? scheduled.get(e.lessonId) : undefined;
      let line: string;
      if (e.isRemoved) {
        line = `Admin took ${day}'s ${e.subjectName} off your pay`;
      } else if (lesson && lesson.date !== e.workDate) {
        line = `Admin moved ${e.subjectName} to ${day}, ${formatTimeRange(e.startTime, e.endTime)}`;
      } else if (lesson && hhmm(lesson.startTime) !== hhmm(e.startTime) && hhmm(lesson.endTime) !== hhmm(e.endTime)) {
        line = `Admin changed ${whose} times to ${formatTimeRange(e.startTime, e.endTime)}`;
      } else if (lesson && hhmm(lesson.endTime) !== hhmm(e.endTime)) {
        line = `Admin changed ${whose} end time to ${formatTime(e.endTime)}`;
      } else if (lesson && hhmm(lesson.startTime) !== hhmm(e.startTime)) {
        line = `Admin changed ${whose} start time to ${formatTime(e.startTime)}`;
      } else {
        line = `Admin corrected ${day}'s ${e.subjectName}`;
      }
      const note = e.note?.trim();
      return note ? `${line}: ${note}` : line;
    });
}
