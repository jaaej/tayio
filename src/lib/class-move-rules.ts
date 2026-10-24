import { formatTimeRange } from "@/lib/format";

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type ClassMoveFacts = {
  fromClassId: string;
  toClassId: string;
  fromSubjectId: string;
  toSubjectId: string;
  sourceEnrolmentActive: boolean;
  targetEnrolmentActive: boolean;
  targetIsRecurring: boolean;
  targetHasCapacity: boolean;
};

/** Shared server-side rules for request, approval, and direct admin moves. */
export function validateClassMove(facts: ClassMoveFacts): string | null {
  if (!facts.sourceEnrolmentActive) {
    return "The student is no longer enrolled in the current class.";
  }
  if (facts.fromClassId === facts.toClassId) {
    return "Choose a different class.";
  }
  if (facts.fromSubjectId !== facts.toSubjectId) {
    return "The new class must be for the same subject.";
  }
  if (facts.targetEnrolmentActive) {
    return "The student is already enrolled in the selected class.";
  }
  if (!facts.targetIsRecurring) {
    return "Choose a recurring class for a permanent move.";
  }
  if (!facts.targetHasCapacity) {
    return "The selected class is full.";
  }
  return null;
}

export function classScheduleLabel(input: {
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
}): string {
  const day =
    typeof input.weekday === "number"
      ? WEEKDAY_LABELS[input.weekday] ?? "Schedule TBC"
      : "Schedule TBC";
  return input.startTime && input.endTime
    ? `${day}, ${formatTimeRange(input.startTime, input.endTime)}`
    : day;
}

export function pauseStatusLabel(
  status: "none" | "on_break" | "paused",
): string | null {
  if (status === "on_break") return "On break";
  if (status === "paused") return "Paused";
  return null;
}
