import { requireRole } from "@/lib/auth";
import { ParentProgress } from "../_components/parent-progress";

export const dynamic = "force-dynamic";

/** One of the child's subjects in a term, beside the Progress list. */
export default async function ParentProgressSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ child?: string; term?: string }>;
}) {
  const user = await requireRole("parent");
  const [{ id }, { child, term }] = await Promise.all([params, searchParams]);
  return <ParentProgress parentId={user.id} requestedChild={child} subjectId={id} term={term} />;
}
