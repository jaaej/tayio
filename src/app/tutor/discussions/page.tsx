import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { DiscussionsBoardsView } from "@/components/discussions/boards-view";

export default async function TutorDiscussionsPage() {
  const user = await requireRole("tutor");
  const boards = await listAccessibleBoards(user.id, "tutor");

  return (
    <DiscussionsBoardsView
      boards={boards}
      hrefPrefix="/tutor/discussions"
      title="Answer & guide."
      subtitle="Reply to questions on the boards for your classes, plus the general help board."
    />
  );
}
