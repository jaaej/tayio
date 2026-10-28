import "server-only";

import { isFeedbackReleased } from "@/lib/homework-rules";
import { homeworkSolutionIsAvailable } from "@/lib/homework-solution";
import { hasSubmissionFeedback } from "@/lib/markup/store";
import { getHomeworkDetail, getStudentTestRank } from "@/app/student/_lib/queries";
import { signHomeworkAttachment, signHomeworkSubmission } from "@/app/student/homework/_storage";
import type { ParentChild } from "../../_data";

/**
 * One homework as the parent of `children` sees it, read only, or null when
 * none of their linked children has it (the page 404s). The selected child
 * is tried first, so siblings in the same class each open their own work.
 * Unlike the student's loader it never marks the work viewed. Files are
 * signed with the service client only after the family link is checked.
 */
export async function loadParentHomeworkDetail(
  children: ParentChild[],
  selectedId: string | null,
  homeworkId: string,
) {
  const ordered = [
    ...children.filter((c) => c.id === selectedId),
    ...children.filter((c) => c.id !== selectedId),
  ];
  for (const child of ordered) {
    const hw = await getHomeworkDetail(child.id, homeworkId);
    if (!hw) continue;
    const solutionAvailable = homeworkSolutionIsAvailable({
      solutionUrl: hw.solutionUrl,
      dueDate: hw.dueDate,
    });
    const [submissionHref, attachmentHref, solutionHref, testRank, fileFeedback] = await Promise.all([
      signHomeworkSubmission(hw.submissionUrl),
      signHomeworkAttachment(hw.attachmentUrl),
      solutionAvailable ? signHomeworkAttachment(hw.solutionUrl) : Promise.resolve(null),
      hw.isTest && hw.score !== null ? getStudentTestRank(child.id, homeworkId) : Promise.resolve(null),
      isFeedbackReleased(hw.status) ? hasSubmissionFeedback(child.id, hw.submissionUrl) : Promise.resolve(false),
    ]);
    return {
      child,
      hw,
      submissionHref,
      attachmentHref,
      solutionHref,
      solutionLocked: Boolean(hw.solutionUrl) && !solutionAvailable,
      testRank,
      fileFeedback,
    };
  }
  return null;
}
