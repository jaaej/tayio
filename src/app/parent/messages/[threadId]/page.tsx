import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { ConversationPanel } from "@/components/dm/conversation-panel";
import { markThreadRead } from "@/app/_actions/dm";

export default async function ParentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("parent");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "parent");
  await markThreadRead(fd);

  return (
    <ConversationPanel
      threadId={thread.threadId}
      meId={user.id}
      otherName={thread.otherName}
      otherRole={thread.otherRole}
      messages={thread.messages}
      rolePrefix="parent"
    />
  );
}
