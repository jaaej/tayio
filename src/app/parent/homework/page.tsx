import { PageHeader } from "@/components/admin/ui";
import { HomeworkBoard } from "@/components/homework/homework-board";
import { requireRole } from "@/lib/auth";
import { parseBoardParams } from "@/app/student/homework/_lib/homework-board";
import { getHomeworkListItems } from "@/app/student/homework/_lib/homework-data";
import { resolveSelectedChild } from "../_data";
import { EmptyChildrenNotice } from "../_components/empty-children";

export const dynamic = "force-dynamic";

/**
 * The child's homework on the student's own board, read only: due this
 * week, overdue and coming up, or handed in and marked. Each one opens the
 * parent's copy with the submission, mark and feedback.
 */
export default async function ParentHomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; subject?: string; show?: string; q?: string; older?: string }>;
}) {
  const user = await requireRole("parent");
  const sp = await searchParams;
  const { selected } = await resolveSelectedChild(user.id, sp.child);

  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Homework" />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const items = await getHomeworkListItems(selected.id);
  return (
    <HomeworkBoard
      items={items}
      params={parseBoardParams(sp)}
      path="/parent/homework"
      keep={{ child: selected.id }}
      viewer={{ kind: "parent", childFirstName: selected.firstName }}
      messages="/parent/messages"
      now={new Date()}
    />
  );
}
