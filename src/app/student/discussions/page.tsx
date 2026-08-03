import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { DiscussionsBoardsView } from "@/components/discussions/boards-view";

export default async function StudentDiscussionsPage() {
  const user = await requireRole("student");
  const boards = await listAccessibleBoards(user.id, "student");

  return (
    <DiscussionsBoardsView
      boards={boards}
      hrefPrefix="/student/discussions"
      title="Ask. Answer. Level up."
      subtitle="Subject boards for class questions, plus a general help board for everything else."
    />
  );
}
