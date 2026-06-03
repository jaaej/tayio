import { PageHead } from "@/components/student/page-head";
import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { BoardCard } from "@/components/discussions/board-card";

export default async function TutorDiscussionsPage() {
  const user = await requireRole("tutor");
  const boards = await listAccessibleBoards(user.id, "tutor");

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Discussions"
        title="Class discussion boards"
        sub="Answer student questions on the boards for your classes."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {boards.map((b) => (
          <BoardCard
            key={b.id.kind === "admin" ? "admin" : b.id.subjectId}
            board={b}
            hrefPrefix="/tutor/discussions"
          />
        ))}
      </div>
    </div>
  );
}
