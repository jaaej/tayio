import type { ReactNode } from "react";
import { MessagesLayout } from "@/components/dm/messages-layout";
import { requireRole } from "@/lib/auth";
import { loadAdminMessagesInbox } from "./_lib/inbox";

export default async function AdminMessagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole("admin");
  const { threads, groups } = await loadAdminMessagesInbox(user.id);

  return (
    <MessagesLayout threads={threads} groups={groups} hrefPrefix="/admin/messages">
      {children}
    </MessagesLayout>
  );
}
