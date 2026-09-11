export function freeTrialTodayDedupeKey(
  lessonId: string,
  studentId: string,
): string {
  return `free-trial-today:${lessonId}:${studentId}`;
}

export function freeTrialFollowUpDedupeKey(
  studentId: string,
  endDate: string,
): string {
  return `free-trial-follow-up:${studentId}:${endDate}`;
}
