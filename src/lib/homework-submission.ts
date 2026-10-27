import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { homework, homeworkAssignments } from "@/db/schema";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { HOMEWORK_BUCKET } from "@/app/student/homework/_storage";
import { canSubmitHomework, isMarked } from "@/lib/homework-rules";

/*
 * Handing in homework, shared by the upload form and "Submit this file" (the
 * worksheet with the student's writing drawn in). The file is written with
 * the service client after the caller has checked the student owns the
 * assignment: the bucket has no client upload policies (security checklist
 * A5), so the student's own session can't write there.
 */

/** Why a student can't hand in this homework now, or null when they can. */
export function submissionClosedReason(status: string, allowResubmission: boolean): string | null {
  if (canSubmitHomework(status, allowResubmission)) return null;
  return isMarked(status) ? "This homework has been marked." : "Resubmission isn't allowed for this homework.";
}

/** Stores the file under the student's folder and returns its path, or null when storage refused it. */
export async function storeSubmissionFile(
  studentId: string,
  homeworkId: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "submission";
  const path = `${studentId}/${homeworkId}/${Date.now()}-${safeName}`;
  const { error } = await createAdminClient()
    .storage.from(HOMEWORK_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) {
    console.error("[homework-submission] upload failed", { homeworkId, message: error.message });
    return null;
  }
  return path;
}

/**
 * Marks the assignment handed in (late after the due time). Checks again
 * under a row lock that it is still open, since a tutor may have marked it
 * while the file uploaded; when it is not, the stored file is removed and the
 * reason returned.
 */
export async function recordSubmission(
  homeworkId: string,
  studentId: string,
  work: { path: string | null; text: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const closed = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        status: homeworkAssignments.status,
        dueDate: homework.dueDate,
        allowResubmission: homework.allowResubmission,
      })
      .from(homeworkAssignments)
      .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
      .where(and(eq(homeworkAssignments.homeworkId, homeworkId), eq(homeworkAssignments.studentId, studentId)))
      .for("update", { of: homeworkAssignments })
      .limit(1);
    if (!row) return "Assignment not found.";
    const reason = submissionClosedReason(row.status, row.allowResubmission);
    if (reason) return reason;
    const now = new Date();
    await tx
      .update(homeworkAssignments)
      .set({
        status: now > row.dueDate ? "late" : "submitted",
        submittedAt: now,
        ...(work.path ? { submissionUrl: work.path } : {}),
        ...(work.text ? { submissionText: work.text } : {}),
      })
      .where(and(eq(homeworkAssignments.homeworkId, homeworkId), eq(homeworkAssignments.studentId, studentId)));
    return null;
  });
  if (!closed) return { ok: true };
  if (work.path) await createAdminClient().storage.from(HOMEWORK_BUCKET).remove([work.path]);
  return { ok: false, error: closed };
}
