import type { ReactNode } from "react";
import { MessagesLayout } from "@/components/dm/messages-layout";
import { requireRole } from "@/lib/auth";
import { loadStudentMessagesInbox } from "./_lib/inbox";

export default async function StudentMessagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole("student");
  const isUnrestricted =
    (user.app_metadata?.role as string | undefined) === "student_unrestricted";
  const { threads, groups } = await loadStudentMessagesInbox(user.id, isUnrestricted);

  return (
    <MessagesLayout threads={threads} groups={groups} hrefPrefix="/student/messages">
      {children}
    </MessagesLayout>
  );
}
