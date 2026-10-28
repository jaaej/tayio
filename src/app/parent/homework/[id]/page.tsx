import { notFound } from "next/navigation";
import {
  HomeworkDetailFrame,
  HomeworkFeedback,
  HomeworkInstructions,
  HomeworkSubmission,
} from "@/components/homework/homework-detail";
import { requireRole } from "@/lib/auth";
import { classDisplayName } from "@/lib/class-display";
import { isAwaitingMarking, isMarked } from "@/lib/homework-rules";
import { resolveSelectedChild } from "../../_data";
import { loadParentHomeworkDetail } from "../_lib/homework-detail";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A child's homework, read only: the same view the student has, with their
 * submission, mark and the tutor's full feedback. Only a linked child's work
 * opens; anything else is a 404.
 */
export default async function ParentHomeworkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const user = await requireRole("parent");
  const [{ id }, { child: requested }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const { children, selected } = await resolveSelectedChild(user.id, requested);
  const detail = await loadParentHomeworkDetail(children, selected?.id ?? null, id);
  if (!detail) notFound();

  const { child, hw, submissionHref, attachmentHref, solutionHref, solutionLocked, testRank, fileFeedback } =
    detail;
  const viewer = { kind: "parent", childFirstName: child.firstName } as const;
  const classLabel =
    hw.subjectName || hw.className ? classDisplayName(hw.subjectName, hw.className) : "Independent task";

  return (
    <div className="flex max-w-[1040px] flex-col gap-5">
      <HomeworkDetailFrame
        hw={hw}
        status={hw.status}
        classLabel={classLabel}
        backHref={`/parent/homework?child=${child.id}`}
        backLabel="Back to homework"
        now={new Date()}
      >
        <HomeworkInstructions
          hw={hw}
          viewer={viewer}
          attachmentHref={attachmentHref}
          solutionHref={solutionHref}
          solutionLocked={solutionLocked}
        />
        <HomeworkFeedback
          hw={hw}
          viewer={viewer}
          studentId={child.id}
          testRank={testRank}
          fileFeedback={fileFeedback}
        />
        <HomeworkSubmission
          hw={hw}
          viewer={viewer}
          studentId={child.id}
          submissionHref={submissionHref}
          note={
            isMarked(hw.status)
              ? null
              : isAwaitingMarking(hw.status)
                ? "Waiting for the tutor to mark this."
                : hw.status === "resubmission_requested"
                  ? `The tutor asked ${child.firstName} to resubmit this.`
                  : `${child.firstName} hasn't handed this in yet.`
          }
        />
      </HomeworkDetailFrame>
    </div>
  );
}
