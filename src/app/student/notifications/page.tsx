import { requireRole } from "@/lib/auth";
import { NotificationsInbox } from "@/components/student/notifications-inbox";

export default async function StudentNotificationsPage() {
  const user = await requireRole("student");
  return <NotificationsInbox userId={user.id} />;
}
