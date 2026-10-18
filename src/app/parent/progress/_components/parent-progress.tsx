import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { ProgressListPane } from "@/app/student/progress/_components/progress-list-pane";
import {
  ProgressDetailPane,
  ProgressRestingPane,
} from "@/app/student/progress/_components/progress-detail";
import { getProgressDetail, getProgressPane } from "@/app/student/progress/_lib/progress-data";
import { resolveSelectedChild } from "../../_data";
import { EmptyChildrenNotice } from "../../_components/empty-children";

/**
 * The child's Progress, the student's own split view: the term picker,
 * overall mastery and subjects on the left, the chosen subject (mastery,
 * average score, test rank, topics and recent marks) on the right, and the
 * term reports the office issued to the parent. `subjectId` null is the
 * index: wide screens open the first subject, phones show the list.
 */
export async function ParentProgress({
  parentId,
  requestedChild,
  subjectId,
  term,
}: {
  parentId: string;
  requestedChild: string | undefined;
  subjectId: string | null;
  term: string | undefined;
}) {
  const { selected } = await resolveSelectedChild(parentId, requestedChild);
  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Progress" />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const pane = await getProgressPane(selected.id, parentId);
  const shownId = subjectId ?? pane.subjects[0]?.subjectId ?? null;
  const detail = shownId ? await getProgressDetail(selected.id, shownId, term) : null;
  if (subjectId && !detail) notFound();

  const listQuery = new URLSearchParams({ child: selected.id });
  if (term) listQuery.set("term", term);
  const markLinks = { homework: "/parent/homework", quiz: null, query: `?child=${selected.id}` };

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <ProgressListPane
        {...pane}
        basePath="/parent/progress"
        child={selected.id}
        emptySubjects={`${selected.firstName}'s progress appears here once they're enrolled in a class.`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {detail ? (
          <ProgressDetailPane
            detail={detail}
            backHref={`/parent/progress?${listQuery.toString()}`}
            desktopOnly={!subjectId}
            markLinks={markLinks}
          />
        ) : (
          <ProgressRestingPane />
        )}
      </div>
    </div>
  );
}
