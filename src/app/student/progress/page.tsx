import { notFound } from "next/navigation";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { isUnrestrictedStudent } from "@/lib/roles";
import { ProgressDetailPane, ProgressRestingPane } from "./_components/progress-detail";
import { getProgressDetail, getProgressPane } from "./_lib/progress-data";

export const dynamic = "force-dynamic";

/**
 * /student/progress: phones show only the list (from the layout); wide
 * screens open the first subject beside it, which the list marks as
 * selected, so the page never rests on an empty pane.
 */
export default async function StudentProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const user = await requireRole("student");
  const [{ term }, { subjects }] = await Promise.all([
    searchParams,
    getProgressPane(
      user.id,
      isUnrestrictedStudent(user.app_metadata?.role as UserRole | undefined) ? user.id : null,
    ),
  ]);
  const first = subjects[0];
  if (!first) return <ProgressRestingPane />;

  const detail = await getProgressDetail(user.id, first.subjectId, term);
  if (!detail) notFound();
  return <ProgressDetailPane detail={detail} backHref={term ? `/student/progress?term=${encodeURIComponent(term)}` : undefined} desktopOnly />;
}
