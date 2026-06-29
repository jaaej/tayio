import { notFound } from "next/navigation";
import { Card, BackLink, Pill } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
import { markThreadRead } from "@/app/_actions/dm";

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

  return (
    <div className="space-y-4 flex flex-col h-[calc(100dvh-160px)]">
      <BackLink href="/admin/messages">Messages</BackLink>
      <Card className="px-5 py-3.5 flex items-center gap-3 shrink-0">
        <div className="text-[16px] font-extrabold tracking-[-0.01em] text-ink">
          {thread.otherName}
        </div>
        <Pill tone="brand">{thread.otherRole}</Pill>
      </Card>
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5">
          <MessageList messages={thread.messages} meId={user.id} />
        </div>
        <MessageComposer threadId={thread.threadId} rolePrefix="admin" />
      </Card>
    </div>
  );
}
