import { notFound } from "next/navigation";
import { Card } from "@/components/student/card";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
import { ConversationHeader } from "@/components/dm/conversation-header";
import { markThreadRead } from "@/app/_actions/dm";

export default async function StudentThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await requireRole("student");
  const thread = await getThreadForMe(user.id, threadId);
  if (!thread) notFound();

  const fd = new FormData();
  fd.append("threadId", threadId);
  fd.append("rolePrefix", "student");
  await markThreadRead(fd);

  return (
    <div className="space-y-4 flex flex-col h-[calc(100dvh-160px)]">
      <ConversationHeader
        otherName={thread.otherName}
        otherRole={thread.otherRole}
        backHref="/student/messages"
      />
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList
            messages={thread.messages}
            meId={user.id}
            otherName={thread.otherName}
            otherRole={thread.otherRole}
          />
        </div>
        <MessageComposer threadId={thread.threadId} rolePrefix="student" />
      </Card>
    </div>
  );
}
