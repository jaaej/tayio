import { requireRole } from "@/lib/auth";
import { NotificationsInbox } from "@/components/notifications/inbox-page";

export default async function StudentNotificationsPage() {
  const user = await requireRole("student");
  return <NotificationsInbox userId={user.id} />;
}
