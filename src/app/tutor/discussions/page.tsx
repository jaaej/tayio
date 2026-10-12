import { requireRole } from "@/lib/auth";
import {
  countUnansweredThreads,
  listAccessibleBoards,
  listRecentThreads,
} from "@/lib/discussions-queries";
import { DiscussionsBoardsView } from "@/components/discussions/boards-view";

export default async function TutorDiscussionsPage() {
  const user = await requireRole("tutor");
  const [boards, recentThreads, unanswered] = await Promise.all([
    listAccessibleBoards(user.id, "tutor"),
    listRecentThreads(user.id, "tutor"),
    countUnansweredThreads(user.id, "tutor"),
  ]);

  return (
    <DiscussionsBoardsView
      boards={boards}
      recentThreads={recentThreads}
      hrefPrefix="/tutor/discussions"
      rolePrefix="tutor"
      sub={
        unanswered > 0
          ? `${unanswered} ${unanswered === 1 ? "question" : "questions"} in your subjects ${unanswered === 1 ? "has" : "have"} no reply yet`
          : undefined
      }
    />
  );
}
