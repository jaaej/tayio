import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { BoardCard } from "@/components/discussions/board-card";
import { PageHeader, Pill } from "@/components/admin/ui";

export default async function AdminDiscussionsPage() {
  const user = await requireRole("admin");
  const boards = await listAccessibleBoards(user.id, "admin");

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Community"
        title="Discussions"
        sub="Oversight across every subject board and the Admin / Tech board."
        actions={
          <Pill tone="brand">
            {boards.length} {boards.length === 1 ? "board" : "boards"}
          </Pill>
        }
      />
      <section
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rise"
        style={{ animationDelay: "60ms" }}
      >
        {boards.map((b) => (
          <BoardCard
            key={b.id.kind === "admin" ? "admin" : b.id.subjectId}
            board={b}
            hrefPrefix="/admin/discussions"
          />
        ))}
      </section>
    </div>
  );
}
