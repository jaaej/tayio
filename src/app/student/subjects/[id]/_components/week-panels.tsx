import Link from "next/link";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { httpHref } from "@/lib/safe-url";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import { pastDayLabel, type ChecklistTask } from "../../_lib/week-checklist";
import type { StudentCurriculumWeek } from "../_queries";

const POP =
  "transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

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

/** "From {tutor}": the tutor's "For students this week" plan field. */
export function TutorNote({
  week,
  subjectName,
  subjectColor,
  tutorFirstName,
  now,
}: {
  week: StudentCurriculumWeek;
  subjectName: string;
  subjectColor: string | null;
  tutorFirstName: string | null;
  now: Date;
}) {
  if (!week.tutorNote && week.tutorAttachments.length === 0) return null;
  const tone = subjectTone(subjectName, subjectColor);
  const chip = `flex h-[38px] max-w-full items-center gap-2 rounded-[12px] px-3.5 text-[13px] font-extrabold ${POP}`;
  return (
    <section
      aria-labelledby="ft-h"
      className="glass min-w-0 rounded-[24px] p-1.5"
    >
      <div className="flex items-center justify-between pb-2.5 pl-3 pr-2 pt-2">
        <h2 id="ft-h" className="m-0 text-[16px] font-extrabold">
          From {tutorFirstName ?? "your tutor"}
        </h2>
        {week.tutorNoteUpdatedAt && (
          <span className="text-[12px] font-semibold text-[#2E2944]">
            {capitalise(pastDayLabel(week.tutorNoteUpdatedAt, now))}
          </span>
        )}
      </div>
      <div className="panel flex flex-col gap-3 p-4">
        {week.tutorNote && (
          <div className="whitespace-pre-line text-[14px] leading-[1.65]">{week.tutorNote}</div>
        )}
        {week.tutorAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {week.tutorAttachments.map((att) => {
              const href = httpHref(att.url);
              const style = { background: tone.bg, color: tone.fg };
              if (href && att.kind === "file" && att.fileName.toLowerCase().endsWith(".pdf")) {
                return (
                  <span key={att.id} className={`inline-flex max-w-full rounded-[12px] ${POP}`} style={style}>
                    <PdfViewerButton
                      url={href}
                      title={att.fileName}
                      className="h-[38px] min-h-0 max-w-full rounded-[12px] border-0 bg-transparent px-3.5 text-[13px] font-extrabold text-inherit hover:bg-transparent"
                    >
                      <span className="truncate">{att.fileName}</span>
                    </PdfViewerButton>
                  </span>
                );
              }
              return href ? (
                <a
                  key={att.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chip}
                  style={style}
                >
                  <span className="truncate">{att.fileName}</span>
                </a>
              ) : (
                <span key={att.id} className={chip} style={{ ...style, opacity: 0.6 }}>
                  <span className="truncate">{att.fileName}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
