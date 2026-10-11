import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { BoardId } from "@/lib/discussions";
import { adminBoardLabel, subjectBoardLabel } from "@/lib/discussions";
import type { ThreadSummary } from "@/lib/discussions-queries";
import { db } from "@/db/client";
import { subjects } from "@/db/schema";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SubjectDot } from "@/components/admin/ui/glass";
import { NewThreadButton } from "./new-thread-panel";
import { ThreadListPanel } from "./thread-list-panel";
import type { DiscussionRole } from "./role-tone";

/**
 * Shared discussion board view used identically by student, tutor and admin:
 * a glass header with the board name and "New thread", then the board's
 * searchable thread list. All hrefs derive from `rolePrefix` (which equals the
 * URL segment for that role), so the role pages are thin auth+data wrappers.
 */
export async function DiscussionBoardDetail({
  board,
  boardSegment,
  threads,
  rolePrefix,
}: {
  board: BoardId;
  boardSegment: string;
  threads: ThreadSummary[];
  rolePrefix: DiscussionRole;
}) {
  let label = adminBoardLabel();
  let eyebrow = "Open to all subjects";

  if (board.kind === "subject") {
    const subj = await db
      .select({ name: subjects.name, yearLevel: subjects.yearLevel })
      .from(subjects)
      .where(eq(subjects.id, board.subjectId))
      .limit(1);
    if (subj.length === 0) notFound();
    label = subjectBoardLabel(subj[0]);
    eyebrow = "Subject board";
  }

  const backHref = `/${rolePrefix}/discussions`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: backHref, label: "Back to boards" }}
        eyebrow={
          <>
            {board.kind === "subject" && <SubjectDot subject={label} />}
            {eyebrow}
          </>
        }
        title={label}
        actions={
          <NewThreadButton
            boards={[{ segment: boardSegment, label }]}
            rolePrefix={rolePrefix}
          />
        }
      />

      <ThreadListPanel
        title="Threads"
        threads={threads.map((t) => ({
          ...t,
          href: `${backHref}/${boardSegment}/${t.id}`,
        }))}
        searchLabel="Search threads on this board"
        searchPlaceholder="Search questions or names…"
        empty={{ title: "No questions yet", hint: "Use New thread to ask the first one." }}
      />
    </div>
  );
}
