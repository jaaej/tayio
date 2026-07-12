import { notFound } from "next/navigation";
import { Card } from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
import { ConversationHeader } from "@/components/dm/conversation-header";
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
    <div className="space-y-4 flex flex-col h-[calc(100dvh-160px)]">
      <ConversationHeader
        otherName={thread.otherName}
        otherRole={thread.otherRole}
        backHref="/parent/messages"
      />
      <Card className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-5">
          <MessageList
            messages={thread.messages}
            meId={user.id}
            otherName={thread.otherName}
            otherRole={thread.otherRole}
          />
        </div>
        <MessageComposer threadId={thread.threadId} rolePrefix="parent" />
      </Card>
    </div>
  );
}
