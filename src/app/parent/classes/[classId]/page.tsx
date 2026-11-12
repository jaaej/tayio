import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getParentClassSubject } from "../../_data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The parent class page is gone. Links already sent (notifications about a
 * class's time) open the child's Timetable, where the class's lessons and
 * attendance live, the same place the student's copy of the notice opens.
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
  redirect(`/parent/timetable?child=${target.childId}`);
}
