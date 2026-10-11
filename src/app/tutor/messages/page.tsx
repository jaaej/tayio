import { MessagesLayout } from "@/components/dm/messages-layout";
import { requireRole } from "@/lib/auth";
import { loadTutorMessagesInbox } from "./_lib/inbox";

export default async function TutorMessagesPage() {
  const user = await requireRole("tutor");
  const { threads, groups } = await loadTutorMessagesInbox(user.id);

  return (
    <MessagesLayout
      threads={threads}
      groups={groups}
      hrefPrefix="/tutor/messages"
    />
  );
}
