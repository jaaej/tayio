import type { ReactNode } from "react";
import { MessagesLayout } from "@/components/dm/messages-layout";
import { requireRole } from "@/lib/auth";
import { loadParentMessagesInbox } from "./_lib/inbox";

export default async function ParentMessagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole("parent");
  const { threads, groups } = await loadParentMessagesInbox(user.id);

  return (
    <MessagesLayout threads={threads} groups={groups} hrefPrefix="/parent/messages">
      {children}
    </MessagesLayout>
  );
}
