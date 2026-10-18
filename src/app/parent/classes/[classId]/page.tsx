import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getParentClassSubject } from "../../_data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The class page was folded into the subject page, which now holds its
 * attendance and tutor feedback. Links already sent (notifications about a
 * class) land on that subject's attendance.
 */
export default async function ParentClassRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const user = await requireRole("parent");
  const [{ classId }, { child }] = await Promise.all([params, searchParams]);
  if (!UUID.test(classId)) notFound();
  const target = await getParentClassSubject(user.id, classId, child);
  if (!target) notFound();
  redirect(`/parent/subjects/${target.subjectId}?child=${target.childId}&tab=attendance`);
}
