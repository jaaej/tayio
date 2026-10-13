"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Empty,
  ListPane,
  ListPaneGroup,
  ListPaneRow,
  ListPaneSearch,
  ListPaneTitle,
  SegmentedLinks,
} from "@/components/admin/ui";
import { formatScore } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import {
  HOMEWORK_VIEWS,
  formatHomeworkDate,
  groupHomework,
  groupOf,
  homeworkHref,
  matchesHomework,
  parseHomeworkView,
  type HomeworkView,
} from "../_lib/homework-list";
import type { StudentHomeworkListItem } from "../_lib/homework-data";

const EMPTY_VIEW: Record<HomeworkView, string> = {
  all: "No homework set yet.",
  todo: "All caught up - nothing to do.",
  submitted: "Nothing waiting for marking.",
  marked: "Nothing marked yet.",
};

/**
 * Left pane of the Homework split view. It lives in the homework layout, so
 * it stays mounted while the student moves between homework; the view and the
 * search are in the URL, and every row link carries them along.
 */
export function HomeworkListPane({ items }: { items: StudentHomeworkListItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);

  const selected = /^\/student\/homework\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const view = parseHomeworkView(searchParams.get("view"));
  const q = (searchParams.get("q") ?? "").trim();
  const toDo = items.filter((i) => groupOf(i.status) === "todo").length;

  useEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2 + row.offsetHeight / 2;
    }
    // Mount only: later selections are clicks on rows already in view.
  }, []);

  const groups = useMemo(
    () => groupHomework(items.filter((i) => matchesHomework(i, q)), view),
    [items, q, view],
  );

  const viewHref = (next: HomeworkView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const now = new Date();
  const list = { view, q };

  return (
    <ListPane
      labelledBy="homework-list-heading"
      hiddenBelowXl={Boolean(selected)}
      scrollRef={scroller}
      header={
        <>
          <div className="flex items-baseline justify-between gap-3">
            <ListPaneTitle id="homework-list-heading">Homework</ListPaneTitle>
            {toDo > 0 && (
              <span className="text-[13px] font-bold tabular-nums text-warn">{toDo} to do</span>
            )}
          </div>
          <ListPaneSearch label="Search homework" placeholder="Search homework" />
          <SegmentedLinks
            label="Show"
            stretch
            items={HOMEWORK_VIEWS.map((v) => ({
              label: v.label,
              href: viewHref(v.value),
              active: view === v.value,
            }))}
          />
        </>
      }
    >
      {groups.length === 0 ? (
        <Empty>{q ? "Nothing matches this search." : EMPTY_VIEW[view]}</Empty>
      ) : (
        groups.map((group) => (
          <ListPaneGroup
            key={group.key}
            id={`homework-group-${group.key}`}
            label={group.key === "todo" ? <span className="text-warn">{group.label}</span> : group.label}
          >
            {group.items.map((item) => (
              <li key={item.id}>
                <HomeworkRow
                  item={item}
                  now={now}
                  href={homeworkHref(`/student/homework/${item.id}`, list)}
                  selected={item.id === selected}
                />
              </li>
            ))}
          </ListPaneGroup>
        ))
      )}
    </ListPane>
  );
}

const PILL = {
  todo: "bg-warn-bg text-warn",
  overdue: "bg-bad-bg text-bad",
  wait: "bg-info-bg text-info",
  marked: "bg-good-bg text-good",
} as const;

/** One homework: subject bar, title, class and date, and a status pill. */
function HomeworkRow({
  item,
  now,
  href,
  selected,
}: {
  item: StudentHomeworkListItem;
  now: Date;
  href: string;
  selected: boolean;
}) {
  const group = groupOf(item.status);
  const due = new Date(item.dueDate);
  const date =
    group === "marked" && item.markedAt ? new Date(item.markedAt) : due;

  let status: string;
  let pill: keyof typeof PILL;
  if (group === "todo") {
    const overdue = due.getTime() < now.getTime();
    if (item.status === "resubmission_requested") {
      status = "Resubmit";
      pill = "todo";
    } else if (overdue) {
      status = "Overdue";
      pill = "overdue";
    } else {
      status = item.isTest ? "Test" : "Not started";
      pill = "todo";
    }
  } else if (group === "waiting") {
    status = item.status === "late" ? "Late" : "Submitted";
    pill = "wait";
  } else {
    status = item.score !== null ? formatScore(item.score) : "Marked";
    pill = "marked";
  }

  return (
    <ListPaneRow href={href} selected={selected} className="rounded-[12px] p-2.5 hover:bg-[#F6F7FA]">
      <span
        aria-hidden
        className="h-[34px] w-2 shrink-0 rounded-[4px]"
        style={{ backgroundColor: subjectTone(item.subjectName ?? "").dot }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[14px] font-bold">{item.title}</span>
        <span className="truncate text-[12px] text-muted">
          {item.subjectName ?? item.className ?? "Independent task"} · {formatHomeworkDate(date)}
        </span>
      </span>
      <span
        className={cn(
          "flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-[11px] px-2 text-[11px] font-extrabold tabular-nums",
          PILL[pill],
        )}
      >
        {status}
      </span>
    </ListPaneRow>
  );
}
