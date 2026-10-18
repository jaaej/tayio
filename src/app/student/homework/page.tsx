import { requireRole } from "@/lib/auth";
import { HomeworkBoard } from "@/components/homework/homework-board";
import { parseBoardParams } from "./_lib/homework-board";
import { getHomeworkListItems } from "./_lib/homework-data";

export const dynamic = "force-dynamic";

/**
 * /student/homework: what is due this week as cards with a Start button,
 * then overdue work and what is coming up as compact lists. The subject,
 * to do or done, and search filters live in the URL.
 */
export default async function HomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; show?: string; q?: string; older?: string }>;
}) {
  const user = await requireRole("student");
  const [items, sp] = await Promise.all([getHomeworkListItems(user.id), searchParams]);
  return (
    <HomeworkBoard
      items={items}
      params={parseBoardParams(sp)}
      path="/student/homework"
      viewer={{ kind: "student" }}
      messages="/student/messages"
      now={new Date()}
    />
  );
}
