import { requireRole } from "@/lib/auth";
import { listAccessibleBoards } from "@/lib/discussions-queries";
import { BoardCard } from "@/components/discussions/board-card";

export default async function AdminDiscussionsPage() {
  const user = await requireRole("admin");
  const boards = await listAccessibleBoards(user.id, "admin");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Discussions
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Oversight across every subject board and the Admin / Tech board.
        </p>
      </header>
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
