import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ProgressDetailPane } from "../_components/progress-detail";
import { getProgressDetail } from "../_lib/progress-data";

export const dynamic = "force-dynamic";

/** One subject's progress, the right pane of the split view. */
export default async function StudentProgressSubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("student");
  const { id } = await params;
  const detail = await getProgressDetail(user.id, id);
  if (!detail) notFound();
  return <ProgressDetailPane detail={detail} />;
}
