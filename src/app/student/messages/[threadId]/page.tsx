import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/student/card";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { MessageList } from "@/components/dm/message-list";
import { MessageComposer } from "@/components/dm/message-composer";
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
      <Link
        href="/student/messages"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-ink"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        Messages
      </Link>
      <Card className="px-4 py-3 flex items-baseline gap-2 shrink-0">
        <div className="text-[16px] font-bold text-ink">{thread.otherName}</div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted font-bold">
          {thread.otherRole}
        </div>
      </Card>
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList messages={thread.messages} meId={user.id} />
        </div>
        <MessageComposer threadId={thread.threadId} rolePrefix="student" />
      </Card>
    </div>
  );
}
