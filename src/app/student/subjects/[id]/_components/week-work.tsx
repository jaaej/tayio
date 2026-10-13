import Link from "next/link";
import { CircleHelp, FileText, PenLine, Play } from "lucide-react";
import type { ChecklistKind, ChecklistTask } from "../../_lib/week-checklist";
import { BookletLink } from "./booklet-link";

const ICON: Record<ChecklistKind, React.ComponentType<{ className?: string }>> = {
  video: Play,
  booklet: FileText,
  homework: PenLine,
  quiz: CircleHelp,
};

/** Solid card colour for unfinished work, by kind. */
const TODO_BG: Record<ChecklistKind, string> = {
  homework: "#FF5A6E",
  video: "#3B6BFF",
  booklet: "#E8890C",
  quiz: "#6A4BE6",
};

/** Tinted icon tile on a finished (white) card, by kind. */
const DONE_ICON: Record<ChecklistKind, { bg: string; fg: string }> = {
  video: { bg: "#E4ECFF", fg: "#3B6BFF" },
  booklet: { bg: "#FDF1E0", fg: "#B45309" },
  homework: { bg: "#E8F6F1", fg: "#159A7C" },
  quiz: { bg: "#EEEBFD", fg: "#3A1AA8" },
};

type Look = {
  bg: string;
  fg: string;
  border: string;
  iconBg: string;
  iconFg: string;
  tagBg: string;
  tagFg: string;
  tag: string;
};

function look(task: ChecklistTask): Look {
  if (task.state === "done") {
    return {
      bg: "#FFFFFF",
      fg: "#17152B",
      border: "#E3E5EE",
      iconBg: DONE_ICON[task.kind].bg,
      iconFg: DONE_ICON[task.kind].fg,
      tagBg: "#E3F4EC",
      tagFg: "#15803D",
      tag: "Done",
    };
  }
  if (task.state === "waiting") {
    return {
      bg: "#F1F2F7",
      fg: "#5E5A73",
      border: "#E3E5EE",
      iconBg: "#FFFFFF",
      iconFg: "#8C8AA0",
      tagBg: "#FFFFFF",
      tagFg: "#5E5A73",
      tag: "Not ready",
    };
  }
  return {
    bg: task.state === "overdue" ? "#FF5A6E" : TODO_BG[task.kind],
    fg: "#FFFFFF",
    border: "transparent",
    iconBg: "rgba(255,255,255,.22)",
    iconFg: "#FFFFFF",
    tagBg: "rgba(255,255,255,.22)",
    tagFg: "#FFFFFF",
    tag: task.state === "overdue" ? "Overdue" : "To do",
  };
}

const CARD =
  "flex min-h-[150px] flex-col gap-2.5 rounded-[22px] border p-[18px] text-left";
const POP =
  "transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[3px] hover:shadow-[0_16px_30px_rgba(23,21,43,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** "This week's work": solid colour cards for unfinished work, white once done. */
export function WeekWork({
  tasks,
  subjectWeekId,
}: {
  tasks: ChecklistTask[];
  subjectWeekId: string;
}) {
  return (
    <section aria-labelledby="wk-h" className="flex flex-col gap-3">
      <h2 id="wk-h" className="m-0 px-1 text-[18px] font-extrabold">
        This week’s work
      </h2>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]">
        {tasks.map((task) => (
          <TaskCard key={task.key} task={task} subjectWeekId={subjectWeekId} />
        ))}
      </div>
    </section>
  );
}

function TaskCard({ task, subjectWeekId }: { task: ChecklistTask; subjectWeekId: string }) {
  const l = look(task);
  const Icon = ICON[task.kind];
  const style = { background: l.bg, color: l.fg, borderColor: l.border };
  const body = (
    <>
      <span className="flex w-full items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[12px]"
          style={{ background: l.iconBg, color: l.iconFg }}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span
          className="flex h-[26px] items-center rounded-[13px] px-2.5 text-[12px] font-extrabold"
          style={{ background: l.tagBg, color: l.tagFg }}
        >
          {l.tag}
        </span>
      </span>
      <span className="text-[18px] font-extrabold leading-[1.2]">{task.title}</span>
      <span className="mt-auto text-[13px] font-bold opacity-90">{task.meta}</span>
    </>
  );

  if (task.state === "waiting") {
    return (
      <div className={CARD} style={style}>
        {body}
      </div>
    );
  }
  if (task.kind === "booklet") {
    return (
      <BookletLink subjectWeekId={subjectWeekId} className={`${CARD} ${POP}`} style={style}>
        {body}
      </BookletLink>
    );
  }
  if (task.kind === "video") {
    return (
      <a href="#recording" className={`${CARD} ${POP}`} style={style}>
        {body}
      </a>
    );
  }
  return (
    <Link href={task.href ?? "#"} className={`${CARD} ${POP}`} style={style}>
      {body}
    </Link>
  );
}
