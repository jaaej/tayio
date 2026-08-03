import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { DiscussionsBoardsView } from "@/components/discussions/boards-view";

export default async function AdminDiscussionsPage() {
  const user = await requireRole("admin");
  const boards = await listAccessibleBoards(user.id, "admin");

  return (
    <DiscussionsBoardsView
      boards={boards}
      hrefPrefix="/admin/discussions"
      title="Oversee every board."
      subtitle="All subject boards and the general help board in one place."
    />
  );
}
