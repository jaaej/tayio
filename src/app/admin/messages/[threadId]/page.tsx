import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { ConversationPanel } from "@/components/dm/conversation-panel";
import { MessagesLayout } from "@/components/dm/messages-layout";
import { markThreadRead } from "@/app/_actions/dm";
import { loadAdminMessagesInbox } from "../_lib/inbox";

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

  // Loaded after marking read so the list shows this thread as read.
  const { threads, groups } = await loadAdminMessagesInbox(user.id);

  return (
    <MessagesLayout
      threads={threads}
      groups={groups}
      hrefPrefix="/admin/messages"
      activeThreadId={thread.threadId}
    >
      <ConversationPanel
        threadId={thread.threadId}
        meId={user.id}
        otherName={thread.otherName}
        otherRole={thread.otherRole}
        messages={thread.messages}
        rolePrefix="admin"
        profileHref={`/admin/users/${thread.otherUserId}`}
      />
    </MessagesLayout>
  );
}
