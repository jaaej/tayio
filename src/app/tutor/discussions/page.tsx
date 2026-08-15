import { requireRole } from "@/lib/auth";
import {
  listAccessibleBoards,
  listRecentThreads,
} from "@/lib/discussions-queries";
import { DiscussionsBoardsView } from "@/components/discussions/boards-view";

export default async function TutorDiscussionsPage() {
  const user = await requireRole("tutor");
  const [boards, recentThreads] = await Promise.all([
    listAccessibleBoards(user.id, "tutor"),
    listRecentThreads(user.id, "tutor"),
  ]);

  return (
    <DiscussionsBoardsView
      boards={boards}
      recentThreads={recentThreads}
      hrefPrefix="/tutor/discussions"
      title="Answer & guide."
      userFirstName={
        (user.user_metadata?.first_name as string | undefined) ??
        user.email?.split("@")[0] ??
        "you"
      }
      rolePrefix="tutor"
    />
  );
}
