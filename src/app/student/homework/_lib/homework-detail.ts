import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { homeworkAssignments } from "@/db/schema";
import { homeworkSolutionIsAvailable } from "@/lib/homework-solution";
import { createClient } from "@/lib/supabase/server";
import { getHomeworkDetail, getStudentTestRank } from "../../_lib/queries";
import { HOMEWORK_BUCKET, signHomeworkAttachment } from "../_storage";

/**
 * Everything the detail pane needs for one homework, or null when it is not
 * set for this student (the caller 404s). Opening it the first time marks it
 * viewed. Files come back as short-lived signed URLs, and the solution only
 * once its due date has passed.
 */
export async function loadHomeworkDetail(studentId: string, homeworkId: string) {
  const hw = await getHomeworkDetail(studentId, homeworkId);
  if (!hw) return null;

  let status = hw.status;
  if (status === "not_started") {
    await db
      .update(homeworkAssignments)
      .set({ status: "viewed" })
      .where(
        and(
          eq(homeworkAssignments.homeworkId, homeworkId),
          eq(homeworkAssignments.studentId, studentId),
        ),
      );
    status = "viewed";
  }

  const solutionAvailable = homeworkSolutionIsAvailable({
    solutionUrl: hw.solutionUrl,
    dueDate: hw.dueDate,
  });

  const [submissionHref, attachmentHref, solutionHref, testRank] = await Promise.all([
    signedSubmissionLink(hw.submissionUrl),
    signHomeworkAttachment(hw.attachmentUrl),
    solutionAvailable ? signHomeworkAttachment(hw.solutionUrl) : Promise.resolve(null),
    // Only for a test the student has been marked on. Anonymous: rank and
    // cohort size only.
    hw.isTest && hw.score !== null ? getStudentTestRank(studentId, homeworkId) : Promise.resolve(null),
  ]);

  // status is "viewed" rather than "not_started" by now.
  const canSubmit =
    status === "viewed" ||
    status === "resubmission_requested" ||
    ((status === "submitted" || status === "late") && hw.allowResubmission);

  return {
    hw,
    status,
    canSubmit,
    submissionHref,
    attachmentHref,
    solutionHref,
    /** A solution exists but stays locked until the due date. */
    solutionLocked: Boolean(hw.solutionUrl) && !solutionAvailable,
    testRank,
  };
}

export type HomeworkDetail = NonNullable<Awaited<ReturnType<typeof loadHomeworkDetail>>>;

async function signedSubmissionLink(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(HOMEWORK_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
