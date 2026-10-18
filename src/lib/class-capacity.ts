export type ClassType = "group" | "one_on_one";

/** A new group class's places, until an admin changes it. */
export const DEFAULT_GROUP_CAPACITY = 8;

/** A one-on-one class has exactly one place (migration 0066 checks it too). */
export function classCapacity(classType: ClassType, capacity: number): number {
  return classType === "one_on_one" ? 1 : capacity;
}

/** Why a class can't keep `students` current students, or null when it can. */
export function oneOnOneError(classType: ClassType, students: number): string | null {
  return classType === "one_on_one" && students > 1
    ? "A one-on-one class has one student. Withdraw the others, or make it a group."
    : null;
}
