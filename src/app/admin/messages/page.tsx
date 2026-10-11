import { MessagesLayout } from "@/components/dm/messages-layout";
import { requireRole } from "@/lib/auth";
import { loadAdminMessagesInbox } from "./_lib/inbox";

export default async function AdminMessagesPage() {
  const user = await requireRole("admin");
  const { threads, groups } = await loadAdminMessagesInbox(user.id);

  return (
    <MessagesLayout
      threads={threads}
      groups={groups}
      hrefPrefix="/admin/messages"
    />
  );
}
