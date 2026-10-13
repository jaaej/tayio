import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { ProgressListPane } from "./_components/progress-list-pane";
import { getProgressPane } from "./_lib/progress-data";

export const dynamic = "force-dynamic";

/**
 * Progress split view, built like tutor Students: overall mastery and the
 * subjects on the left, the selected subject on the right
 * (`/student/progress/[id]`). The list lives here so it stays mounted while
 * the student moves between subjects. Below xl only one pane shows at a time.
 */
export default async function StudentProgressLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("student");
  const pane = await getProgressPane(user.id);

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <ProgressListPane overall={pane.overall} subjects={pane.subjects} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}
