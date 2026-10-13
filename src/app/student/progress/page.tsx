import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ProgressDetailPane, ProgressRestingPane } from "./_components/progress-detail";
import { getProgressDetail, getProgressPane } from "./_lib/progress-data";

export const dynamic = "force-dynamic";

/**
 * /student/progress: phones show only the list (from the layout); wide
 * screens open the first subject beside it, which the list marks as
 * selected, so the page never rests on an empty pane.
 */
export default async function StudentProgressPage() {
  const user = await requireRole("student");
  const { subjects } = await getProgressPane(user.id);
  const first = subjects[0];
  if (!first) return <ProgressRestingPane />;

  const detail = await getProgressDetail(user.id, first.subjectId);
  if (!detail) notFound();
  return <ProgressDetailPane detail={detail} desktopOnly />;
}
