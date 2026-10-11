import { requireRole } from "@/lib/auth";
import {
  listAccessibleBoards,
  listRecentThreads,
} from "@/lib/discussions-queries";
import { DiscussionsBoardsView } from "@/components/discussions/boards-view";

export default async function StudentDiscussionsPage() {
  const user = await requireRole("student");
  const [boards, recentThreads] = await Promise.all([
    listAccessibleBoards(user.id, "student"),
    listRecentThreads(user.id, "student"),
  ]);

  return (
    <DiscussionsBoardsView
      boards={boards}
      recentThreads={recentThreads}
      hrefPrefix="/student/discussions"
      rolePrefix="student"
    />
  );
}
