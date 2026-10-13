import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { HomeworkListPane } from "./_components/homework-list-pane";
import { getHomeworkListItems } from "./_lib/homework-data";

export const dynamic = "force-dynamic";

/**
 * Homework split view: the list on the left, the selected homework on the
 * right (`/student/homework/[id]`). The list lives here so it stays mounted
 * while the student moves between homework. Below xl only one pane shows at a
 * time.
 */
export default async function HomeworkLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("student");
  const items = await getHomeworkListItems(user.id);

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <HomeworkListPane items={items} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}
