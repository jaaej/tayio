"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  Empty,
  ListPane,
  ListPaneGroup,
  ListPaneRow,
  ListPaneTitle,
  SegmentedLinks,
  SubjectDot,
} from "@/components/admin/ui";
import { initialsOf } from "@/components/admin/ui/glass";
import { cn } from "@/lib/utils";
import {
  MARKING_VIEWS,
  groupToMark,
  listHref,
  matchesQuery,
  parseMarkingView,
  submissionHref,
  type HomeworkItem,
  type MarkingView,
  type SubmissionItem,
} from "../_lib/marking-list";

const DEBOUNCE_MS = 250;

// Melbourne time explicitly, so the server render and hydration agree.
const dayFmt = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
});
const dateFmt = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  day: "numeric",
  month: "short",
});

/** "Mon" within the last week, otherwise "6 Oct". */
function shortWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const ageDays = (Date.now() - d.getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays < 6 ? dayFmt.format(d) : dateFmt.format(d);
}

/**
 * Left pane of the Marking split view. It lives in the homework layout, so it
 * stays mounted while the tutor moves between submissions; the view and the
 * search are in the URL, and every row link carries them along.
 */
export function MarkingQueuePane({
  toMark,
  marked,
  homework,
}: {
  toMark: SubmissionItem[];
  marked: SubmissionItem[];
  homework: HomeworkItem[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);

  const selectedHomework = /^\/tutor\/homework\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const selectedStudent = searchParams.get("student");
  const view = parseMarkingView(searchParams.get("view"));
  const q = (searchParams.get("q") ?? "").trim();

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

  const filtered = useMemo(() => {
    const sub = (i: SubmissionItem) =>
      matchesQuery([i.studentName, i.homeworkTitle, i.classLabel, i.subjectName], q);
    return {
      toMark: toMark.filter(sub),
      marked: marked.filter(sub),
      homework: homework.filter((h) => matchesQuery([h.title, h.classLabel, h.subjectName], q)),
    };
  }, [toMark, marked, homework, q]);

  const viewHref = (next: MarkingView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "to-mark") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const list = { view, q };
  // On phones only one pane shows: the list, unless something is open.
  const detailOpen = Boolean(selectedHomework);

  return (
    <ListPane
      labelledBy="marking-list-heading"
      hiddenBelowXl={detailOpen}
      scrollRef={scroller}
      header={
        <>
          <div className="flex items-baseline justify-between gap-3">
            <ListPaneTitle id="marking-list-heading">Marking</ListPaneTitle>
            {toMark.length > 0 && (
              <span className="text-[13px] font-bold tabular-nums text-warn">
                {toMark.length} to mark
              </span>
            )}
          </div>
          <SearchBox />
          <SegmentedLinks
            label="Show"
            stretch
            items={MARKING_VIEWS.map((v) => ({
              label: v.label,
              href: viewHref(v.value),
              active: view === v.value,
            }))}
          />
        </>
      }
    >
      {view === "to-mark" &&
        (filtered.toMark.length === 0 ? (
          <Empty>{q ? "Nothing matches this search." : "All caught up - nothing waiting to mark."}</Empty>
        ) : (
          groupToMark(filtered.toMark).map((group) => (
            <ListPaneGroup
              key={group.key}
              id={`marking-group-${group.key}`}
              label={
                group.key === "late" ? (
                  <span className="text-bad">Late - review first</span>
                ) : (
                  "Submitted"
                )
              }
            >
              {group.items.map((i) => (
                <li key={`${i.homeworkId}:${i.studentId}`}>
                  <SubmissionRow
                    item={i}
                    when={shortWhen(i.submittedAt)}
                    href={submissionHref(i.homeworkId, i.studentId, list)}
                    selected={i.homeworkId === selectedHomework && i.studentId === selectedStudent}
                  />
                </li>
              ))}
            </ListPaneGroup>
          ))
        ))}

      {view === "marked" &&
        (filtered.marked.length === 0 ? (
          <Empty>{q ? "Nothing matches this search." : "Nothing marked yet."}</Empty>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.marked.map((i) => (
              <li key={`${i.homeworkId}:${i.studentId}`}>
                <SubmissionRow
                  item={i}
                  when={shortWhen(i.markedAt)}
                  href={submissionHref(i.homeworkId, i.studentId, list)}
                  selected={i.homeworkId === selectedHomework && i.studentId === selectedStudent}
                />
              </li>
            ))}
          </ul>
        ))}

      {view === "homework" &&
        (filtered.homework.length === 0 ? (
          <Empty>{q ? "Nothing matches this search." : "No homework set yet."}</Empty>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.homework.map((h) => (
              <li key={h.id}>
                <ListPaneRow
                  href={listHref(`/tutor/homework/${h.id}`, list)}
                  selected={h.id === selectedHomework && !selectedStudent}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate text-[14px] font-bold">{h.title}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
                      {h.subjectName && <SubjectDot subject={h.subjectName} color={h.subjectColor} />}
                      <span className="truncate">
                        {[h.classLabel, `due ${dateFmt.format(new Date(h.dueDate))}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                  {h.toMark > 0 ? (
                    <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-warn-bg px-[7px] text-[11px] font-extrabold tabular-nums text-warn">
                      {h.toMark} to mark
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted">
                      {h.marked}/{h.total}
                    </span>
                  )}
                </ListPaneRow>
              </li>
            ))}
          </ul>
        ))}
    </ListPane>
  );
}

function SubmissionRow({
  item,
  when,
  href,
  selected,
}: {
  item: SubmissionItem;
  when: string;
  href: string;
  selected: boolean;
}) {
  return (
    <ListPaneRow href={href} selected={selected}>
      <span
        aria-hidden
        className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-brand-100 text-[12px] font-extrabold text-brand-600"
      >
        {initialsOf(item.studentName)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[14px] font-bold">{item.studentName}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
          {item.subjectName && <SubjectDot subject={item.subjectName} color={item.subjectColor} />}
          <span className="truncate">{item.homeworkTitle}</span>
        </span>
      </span>
      {when && (
        <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-muted">{when}</span>
      )}
    </ListPaneRow>
  );
}

/** Debounced search that writes `q` to the URL without a server round-trip. */
function SearchBox() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const pushed = useRef(queryParam);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt the URL only when it changed on its own (back button, a link),
  // never while our own debounced write is in flight.
  useEffect(() => {
    if (queryParam !== pushed.current) {
      pushed.current = queryParam;
      setQuery(queryParam);
    }
  }, [queryParam]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function write(value: string) {
    pushed.current = value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    const qs = params.toString();
    // The list filters on the client: change the URL, not the server render.
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="relative block">
      <span className="sr-only">Search submissions</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => write(next.trim()), DEBOUNCE_MS);
        }}
        placeholder="Search student or homework"
        className="h-[38px] w-full rounded-[11px] border border-white/90 bg-surface pl-9 pr-9 text-[13px] text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            setQuery("");
            write("");
          }}
          className={cn(
            "absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[9px] text-muted transition-colors hover:bg-surface-2 hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          )}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </label>
  );
}
