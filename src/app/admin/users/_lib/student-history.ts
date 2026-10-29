import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, studentLeave, studentTrials } from "@/db/schema";
import { signHomeworkSubmission } from "@/app/student/homework/_storage";
import { formatDateShort } from "@/lib/format";
import { markupFileKind } from "@/lib/markup/doc";
import { staffNotesTimeline, type StaffNote } from "@/lib/student-history";
import { getStudentRecord, type RecordHomework, type StudentRecord } from "@/lib/student-record";

export type AdminHomework = RecordHomework & {
  /** A signed link for a hand-in the writing viewer cannot open (a Word file, say). */
  submissionHref: string | null;
};

export type StudentHistory = {
  record: StudentRecord;
  homework: AdminHomework[];
  /** The account's internal note: it has no date, so it heads the staff notes. */
  accountNote: string | null;
  notes: StaffNote[];
};

function range(start: string, end: string) {
  return start === end ? formatDateShort(start) : `${formatDateShort(start)} - ${formatDateShort(end)}`;
}

/** A stored PDF or picture: it opens in the writing viewer, with the tutor's marks. */
function opensInViewer(path: string) {
  return !path.startsWith("http") && markupFileKind(path) !== null;
}

/**
 * The admin profile's History tab: the student's record as a tutor sees it
 * (`getStudentRecord`, unscoped), plus the staff notes that belong to no
 * lesson: the account note, leave and the free trial.
 */
export async function getStudentHistory(studentId: string): Promise<StudentHistory> {
  const [record, leave, trial, account] = await Promise.all([
    getStudentRecord(studentId, { kind: "admin" }),
    db
      .select({
        id: studentLeave.id,
        startDate: studentLeave.startDate,
        endDate: studentLeave.endDate,
        note: studentLeave.note,
      })
      .from(studentLeave)
      .where(eq(studentLeave.studentId, studentId)),
    db
      .select({
        startDate: studentTrials.startDate,
        endDate: studentTrials.endDate,
        note: studentTrials.note,
      })
      .from(studentTrials)
      .where(eq(studentTrials.studentId, studentId))
      .limit(1),
    db
      .select({ note: profiles.adminNotes })
      .from(profiles)
      .where(eq(profiles.id, studentId))
      .limit(1),
  ]);

  // Signed with the service client: the page has already required an admin.
  const homework = await Promise.all(
    record.homework.map(async (h) => ({
      ...h,
      submissionHref:
        h.submissionUrl && !opensInViewer(h.submissionUrl) ? await signHomeworkSubmission(h.submissionUrl) : null,
    })),
  );

  return {
    record,
    homework,
    accountNote: account[0]?.note?.trim() || null,
    notes: staffNotesTimeline({ leave, trial: trial[0] ?? null, formatRange: range }),
  };
}
