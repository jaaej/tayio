import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ProgressDetailPane } from "../_components/progress-detail";
import { getProgressDetail } from "../_lib/progress-data";

export const dynamic = "force-dynamic";

/** One subject's progress in a term, the right pane of the split view. */
export default async function StudentProgressSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const user = await requireRole("student");
  const [{ id }, { term }] = await Promise.all([params, searchParams]);
  const detail = await getProgressDetail(user.id, id, term);
  if (!detail) notFound();
  return <ProgressDetailPane detail={detail} backHref={term ? `/student/progress?term=${encodeURIComponent(term)}` : undefined} />;
}
