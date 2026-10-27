import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  HomeworkDetailFrame,
  HomeworkFeedback,
  HomeworkInstructions,
  HomeworkSubmission,
} from "@/components/homework/homework-detail";
import { requireRole } from "@/lib/auth";
import { classDisplayName } from "@/lib/class-display";
import { isMarked } from "@/lib/homework-rules";
import { loadHomeworkDetail } from "../_lib/homework-detail";
import { boardHref, parseBoardParams } from "../_lib/homework-board";
import { SubmissionForm } from "./_components/submission-form";

export const dynamic = "force-dynamic";

/**
 * One homework, opened from the Homework page: instructions, worksheet and
 * solution, the student's work with Submit or Resubmit, and the tutor's
 * feedback and score once marked. The view is shared with the parent's
 * read-only copy (`/parent/homework/[id]`).
 */
export default async function HomeworkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string; subject?: string; show?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireRole("student");
  const detail = await loadHomeworkDetail(user.id, id);
  if (!detail) notFound();

  const { hw, status, canSubmit, submissionHref, attachmentHref, solutionHref, solutionLocked, testRank } =
    detail;
  const classLabel = hw.subjectName || hw.className ? classDisplayName(hw.subjectName, hw.className) : "Independent task";
  const marked = isMarked(status);
  const viewer = { kind: "student" } as const;

  return (
    <HomeworkDetailFrame
      hw={hw}
      status={status}
      classLabel={classLabel}
      backHref={boardHref("/student/homework", parseBoardParams(sp))}
      backLabel="Back to homework"
      now={new Date()}
    >
      {sp.submitted && (
        <p
          role="status"
          className="flex items-center gap-2.5 border-b border-[#EFF0F5] bg-good-bg px-4 py-3 text-[13px] font-semibold text-good"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Submission received. Your tutor will mark it soon.
        </p>
      )}
      {sp.error && (
        <p
          role="alert"
          className="flex items-center gap-2.5 border-b border-[#EFF0F5] bg-bad-bg px-4 py-3 text-[13px] font-semibold text-bad"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {`Couldn't submit: ${safeDecode(sp.error)}`}
        </p>
      )}

      <HomeworkInstructions
        hw={hw}
        viewer={viewer}
        attachmentHref={attachmentHref}
        solutionHref={solutionHref}
        solutionLocked={solutionLocked}
      />
      <HomeworkFeedback hw={hw} testRank={testRank} />
      <HomeworkSubmission
        hw={hw}
        viewer={viewer}
        studentId={user.id}
        submissionHref={submissionHref}
        note={
          !canSubmit && !marked
            ? hw.submittedAt
              ? "Waiting for your tutor to mark this."
              : "Submissions are closed for this homework."
            : null
        }
        divider={canSubmit}
      />

      {canSubmit && <SubmissionForm homeworkId={hw.homeworkId} resubmit={Boolean(hw.submittedAt)} />}
    </HomeworkDetailFrame>
  );
}

/** The submit route encodes its message once; tolerate a malformed value. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
