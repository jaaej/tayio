import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getThreadForMe } from "@/lib/dm-queries";
import { ConversationPanel } from "@/components/dm/conversation-panel";
import { markThreadRead } from "@/app/_actions/dm";
import { getConversationContext } from "@/lib/dm-context";
import { tutorSubjectLink } from "../_lib/inbox";

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

  const [context, subjectLink] = await Promise.all([
    getConversationContext(
      { id: user.id, role: "student" },
      { id: thread.otherUserId, role: thread.otherRole },
    ),
    thread.otherRole === "tutor"
      ? tutorSubjectLink(user.id, thread.otherUserId)
      : Promise.resolve(null),
  ]);

  return (
    <ConversationPanel
      threadId={thread.threadId}
      meId={user.id}
      otherName={thread.otherName}
      otherRole={thread.otherRole}
      messages={thread.messages}
      rolePrefix="student"
      context={context.context ?? undefined}
      profileHref={context.profileHref ?? subjectLink?.href}
      profileLabel={context.profileLabel ?? subjectLink?.label}
    />
  );
}
