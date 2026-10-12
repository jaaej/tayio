import type { ReactNode } from "react";
import { requireTutor } from "../_data";
import { MarkingQueuePane } from "./_components/marking-queue-pane";
import { getMarkingPaneData } from "./_lib/marking-data";

export const dynamic = "force-dynamic";

/**
 * Marking split view: the queue on the left, the selected homework or
 * submission on the right (`/tutor/homework/[homeworkId]?student=`). The list
 * lives here so it stays mounted while the tutor moves between submissions.
 * Below xl only one pane shows at a time.
 */
export default async function MarkingLayout({ children }: { children: ReactNode }) {
  const tutor = await requireTutor();
  const data = await getMarkingPaneData(tutor.id);

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <MarkingQueuePane toMark={data.toMark} marked={data.marked} homework={data.homework} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}
