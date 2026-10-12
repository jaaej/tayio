import type { ReactNode } from "react";
import { requireTutor } from "../_data";
import { getStudentPaneData } from "./_lib/student-data";
import { StudentListPane } from "./_components/student-list-pane";

export const dynamic = "force-dynamic";

/**
 * Students split view, built like admin Users: the roster grouped by class on
 * the left, the selected student on the right (`/tutor/students/[id]`). The
 * list lives here so it is fetched once and stays mounted while the tutor
 * moves between profiles. Below xl only one pane shows at a time: the list on
 * /tutor/students, the profile (with a back button) on /tutor/students/[id].
 */
export default async function StudentsLayout({ children }: { children: ReactNode }) {
  const tutor = await requireTutor();
  const data = await getStudentPaneData(tutor.id);

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <StudentListPane groups={data.groups} years={data.years} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}
