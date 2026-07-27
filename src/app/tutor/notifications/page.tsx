import { requireRole } from "@/lib/auth";
import { NotificationsInbox } from "@/components/notifications/inbox-page";

export default async function TutorNotificationsPage() {
  const user = await requireRole("tutor");
  return <NotificationsInbox userId={user.id} />;
}
