import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { ConversationPanel } from "@/components/dm/conversation-panel";
import { MessagesLayout } from "@/components/dm/messages-layout";
import { markThreadRead } from "@/app/_actions/dm";
import { getConversationContext } from "@/lib/dm-context";
import { loadTutorMessagesInbox } from "../_lib/inbox";

export default async function TutorThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("tutor");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "tutor");
  await markThreadRead(fd);

  // Loaded after marking read so the list shows this thread as read.
  const [{ threads, groups }, context] = await Promise.all([
    loadTutorMessagesInbox(user.id),
    getConversationContext(
      { id: user.id, role: "tutor" },
      { id: thread.otherUserId, role: thread.otherRole },
    ),
  ]);

  return (
    <MessagesLayout
      threads={threads}
      groups={groups}
      hrefPrefix="/tutor/messages"
      activeThreadId={thread.threadId}
    >
      <ConversationPanel
        threadId={thread.threadId}
        meId={user.id}
        otherName={thread.otherName}
        otherRole={thread.otherRole}
        messages={thread.messages}
        rolePrefix="tutor"
        context={context.context ?? undefined}
        profileHref={context.profileHref}
        profileLabel={context.profileLabel}
      />
    </MessagesLayout>
  );
}
