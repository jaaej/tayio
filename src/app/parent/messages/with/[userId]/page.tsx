import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canDM, getUserRole } from "@/lib/dm-permissions";
import { getOrCreateThread } from "@/lib/dm-queries";

export default async function ParentDMWithPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await requireRole("parent");

  const targetRole = await getUserRole(userId);
  if (!targetRole) notFound();
  if (!(await canDM(user.id, "parent", userId, targetRole))) notFound();

  const threadId = await getOrCreateThread(user.id, userId);
  redirect(`/parent/messages/${threadId}`);
}
