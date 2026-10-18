import type { UserRole } from "@/db/schema";
import { isUnrestrictedStudent } from "@/lib/roles";

/**
 * Who a student's term report goes to: every linked parent, plus the student
 * when they can open their own report (unrestricted). Restricted students
 * reach their report through a parent.
 */
export function termReportRecipients(
  student: { id: string; role: UserRole | string },
  parentIds: readonly string[],
): string[] {
  const ids = new Set(parentIds);
  if (isUnrestrictedStudent(student.role as UserRole)) ids.add(student.id);
  return [...ids];
}
