import { requireRole } from "@/lib/auth";
import { NotificationsInbox } from "@/components/notifications/inbox-page";

export default async function ParentNotificationsPage() {
  const user = await requireRole("parent");
  return <NotificationsInbox userId={user.id} />;
}
