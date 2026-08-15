import { requireRole } from "@/lib/auth";
import {
  listAccessibleBoards,
  listRecentThreads,
} from "@/lib/discussions-queries";
import { DiscussionsBoardsView } from "@/components/discussions/boards-view";

export default async function AdminDiscussionsPage() {
  const user = await requireRole("admin");
  const [boards, recentThreads] = await Promise.all([
    listAccessibleBoards(user.id, "admin"),
    listRecentThreads(user.id, "admin"),
  ]);

  return (
    <DiscussionsBoardsView
      boards={boards}
      recentThreads={recentThreads}
      hrefPrefix="/admin/discussions"
      title="Oversee every board."
      userFirstName={
        (user.user_metadata?.first_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "you"
      }
      rolePrefix="admin"
    />
  );
}
