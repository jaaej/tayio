import { requireRole } from "@/lib/auth";
import { NotificationsInbox } from "@/components/notifications/inbox-page";

export default async function AdminNotificationsPage() {
  const user = await requireRole("admin");
  return <NotificationsInbox userId={user.id} />;
}
