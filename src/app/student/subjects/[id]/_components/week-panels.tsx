import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ChecklistTask } from "../../_lib/week-checklist";

const PILL = "flex h-9 shrink-0 items-center rounded-[11px] px-3.5 text-[13px] font-extrabold";

/**
 * "Homework": the week's homework as rows, with Start or Done on the right.
 * A parent (`hrefFor`) opens their child's read-only copy and sees Done or
 * To do instead of Start.
 */
export function WeekHomework({
  tasks,
  hrefFor,
}: {
  tasks: ChecklistTask[];
  hrefFor?: (task: ChecklistTask) => string;
}) {
  const done = tasks.filter((t) => t.state === "done").length;
  return (
    <section aria-labelledby="hw-h" className="glass flex min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5">
      <div className="flex items-center justify-between gap-3 pb-1 pl-3 pr-2 pt-2">
        <h2 id="hw-h" className="m-0 text-[16px] font-extrabold">
          Homework
        </h2>
        {tasks.length > 0 && (
          <span className="text-[13px] font-bold tabular-nums text-[#2E2944]">
            {done} of {tasks.length} done
          </span>
        )}
      </div>
      <div className="panel overflow-hidden">
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-center text-[14px] text-[#5E5A73]">No homework this week.</p>
        ) : (
          <ul className="m-0 list-none divide-y divide-[#EFF0F5] p-0">
            {tasks.map((task) => (
              <li key={task.key}>
                <Link
                  href={hrefFor ? hrefFor(task) : (task.href ?? "#")}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[#F7F8FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-extrabold">{task.title}</span>
                    <span
                      className={cn(
                        "truncate text-[13px] font-medium",
                        task.state === "overdue" ? "font-bold text-[#C8102E]" : "text-[#5E5A73]",
                      )}
                    >
                      {task.meta}
                    </span>
                  </span>
                  {task.state === "done" ? (
                    <span className={cn(PILL, "bg-[#E3F4EC] text-[#15803D]")}>Done</span>
                  ) : hrefFor ? (
                    <span className={cn(PILL, "bg-[#F1F2F7] text-[#2E2944]")}>
                      {task.resubmit ? "Resubmit" : "To do"}
                    </span>
                  ) : (
                    <span className={cn(PILL, "bg-[#FF5A6E] text-white")}>
                      {task.resubmit ? "Resubmit" : "Start"}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * "Weekly quiz": the approved quiz, or "Not ready yet" while a requested
 * quiz is still being written. Weeks with no quiz requested show nothing.
 * A parent (`readOnly`) sees whether their child did it; only the student
 * can open the quiz.
 */
export function WeeklyQuiz({
  task,
  inProgress,
  tutorFirstName,
  readOnly = false,
}: {
  task: ChecklistTask | undefined;
  inProgress: boolean;
  tutorFirstName: string | null;
  readOnly?: boolean;
}) {
  if (!task && !inProgress) return null;
  return (
    <section aria-labelledby="qz-h" className="glass flex min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5">
      <h2 id="qz-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold">
        Weekly quiz
      </h2>
      {task && readOnly ? (
        <div className="panel flex items-center gap-3 px-4 py-3.5">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-extrabold">{task.title}</span>
            <span className="truncate text-[13px] font-medium text-[#5E5A73]">{task.meta}</span>
          </span>
          {task.state === "done" ? (
            <span className={cn(PILL, "bg-[#E3F4EC] text-[#15803D]")}>Done</span>
          ) : (
            <span className={cn(PILL, "bg-[#F1F2F7] text-[#2E2944]")}>To do</span>
          )}
        </div>
      ) : task ? (
        <Link
          href={task.href ?? "#"}
          className="panel flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-[#F7F8FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-extrabold">{task.title}</span>
            <span className="truncate text-[13px] font-medium text-[#5E5A73]">{task.meta}</span>
          </span>
          {task.state === "done" ? (
            <span className={cn(PILL, "bg-[#E3F4EC] text-[#15803D]")}>Done</span>
          ) : (
            <span className={cn(PILL, "bg-[#6A4BE6] text-white")}>Start</span>
          )}
        </Link>
      ) : (
        <div className="panel flex flex-col gap-1 px-4 py-3.5">
          <span className="text-[15px] font-extrabold text-[#5E5A73]">Not ready yet</span>
          <span className="text-[13px] text-[#5E5A73]">
            {tutorFirstName ?? "Your tutor"} is finishing this quiz
          </span>
        </div>
      )}
    </section>
  );
}
