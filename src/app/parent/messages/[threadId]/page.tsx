import { notFound } from "next/navigation";
import { Card, BackLink } from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
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
      <BackLink href="/parent/messages">Messages</BackLink>
      <Card className="shrink-0">
        <div className="px-5 py-3 flex items-baseline gap-2">
          <div className="text-lg font-bold text-ink">{thread.otherName}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-medium">
            {thread.otherRole}
          </div>
        </div>
      </Card>
      <Card className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-5">
          <MessageList messages={thread.messages} meId={user.id} />
        </div>
        <MessageComposer threadId={thread.threadId} rolePrefix="parent" />
      </Card>
    </div>
  );
}
