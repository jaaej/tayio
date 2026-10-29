import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { ConversationPanel } from "@/components/dm/conversation-panel";
import { markThreadRead } from "@/app/_actions/dm";
import { getConversationContext } from "@/lib/dm-context";

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("admin");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "admin");
  await markThreadRead(fd);

  const context = await getConversationContext(
    { id: user.id, role: "admin" },
    { id: thread.otherUserId, role: thread.otherRole },
  );

  return (
    <ConversationPanel
      threadId={thread.threadId}
      meId={user.id}
      otherName={thread.otherName}
      otherRole={thread.otherRole}
      messages={thread.messages}
      rolePrefix="admin"
      context={context.context ?? undefined}
      profileHref={context.profileHref}
      profileLabel={context.profileLabel}
    />
  );
}
