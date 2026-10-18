import { requireRole } from "@/lib/auth";
import { ParentProgress } from "./_components/parent-progress";

export const dynamic = "force-dynamic";

/** The child's Progress list; wide screens open the first subject beside it. */
export default async function ParentProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; term?: string }>;
}) {
  const user = await requireRole("parent");
  const { child, term } = await searchParams;
  return <ParentProgress parentId={user.id} requestedChild={child} subjectId={null} term={term} />;
}
