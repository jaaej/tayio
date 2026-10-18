import type { ReactNode } from "react";
import Link from "next/link";
import { formatScore } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import { HomeworkSearch } from "@/app/student/homework/_components/homework-search";
import {
  OVERDUE_PREVIEW,
  boardHref,
  boardSubjects,
  buildDoneBoard,
  buildTodoBoard,
  overdueAge,
  soleTutor,
  type BoardParams,
} from "@/app/student/homework/_lib/homework-board";
import type { StudentHomeworkListItem } from "@/app/student/homework/_lib/homework-data";
import { daysUntil, dueStatus, formatHomeworkDate } from "@/app/student/homework/_lib/homework-list";

const tz = "Australia/Melbourne";
const weekdayFmt = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "short" });
const dayFmt = new Intl.DateTimeFormat("en-AU", { timeZone: tz, day: "numeric" });
const dayMonthFmt = new Intl.DateTimeFormat("en-AU", { timeZone: tz, day: "numeric", month: "short" });

export type HomeworkBoardViewer = { kind: "student" } | { kind: "parent"; childFirstName: string };

type Board = {
  path: string;
  viewer: HomeworkBoardViewer;
  /** Messages home, for "Ask ... which still count". */
  messages: string;
  /** A board or detail URL with the filters and the kept params (`child`). */
  link: (path: string, params: Partial<BoardParams>) => string;
};

/**
 * The Homework board, the same for the student and their parent: what is
 * due this week as cards, then overdue work and what is coming up as
 * compact lists, or what was handed in and marked. The subject, to do or
 * done, and search filters live in the URL. A parent's board (`viewer`
 * parent) is read only: cards open the child's homework with View, and
 * `keep` carries `child` through every link.
 */
export function HomeworkBoard({
  items,
  params,
  path,
  keep = {},
  viewer,
  messages,
  now,
}: {
  items: StudentHomeworkListItem[];
  params: BoardParams;
  path: string;
  keep?: Record<string, string>;
  viewer: HomeworkBoardViewer;
  messages: string;
  now: Date;
}) {
  const subjects = boardSubjects(items);
  const link = (to: string, p: Partial<BoardParams>) => {
    const href = boardHref(to, p);
    const extra = new URLSearchParams(keep).toString();
    return extra ? `${href}${href.includes("?") ? "&" : "?"}${extra}` : href;
  };
  const board: Board = { path, viewer, messages, link };

  const hidden: Record<string, string> = { ...keep };
  if (params.subject) hidden.subject = params.subject;
  if (params.show === "done") hidden.show = "done";

  return (
    <div className="flex flex-col gap-5">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-[24px] px-4 py-3.5 sm:px-6">
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-ink">
          {viewer.kind === "parent" ? `${viewer.childFirstName}'s homework` : "Homework"}
        </h1>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {subjects.length > 1 && (
            <Segmented label="Subject">
              <SegmentLink href={link(path, { ...params, subject: null, older: false })} active={!params.subject}>
                All
              </SegmentLink>
              {subjects.map((s) => (
                <SegmentLink
                  key={s.id}
                  href={link(path, { ...params, subject: s.id, older: false })}
                  active={params.subject === s.id}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: subjectTone(s.name, s.color).dot }}
                  />
                  {s.label}
                </SegmentLink>
              ))}
            </Segmented>
          )}
          <Segmented label="Show">
            <SegmentLink href={link(path, { ...params, show: "todo", older: false })} active={params.show === "todo"}>
              To do
            </SegmentLink>
            <SegmentLink href={link(path, { ...params, show: "done", older: false })} active={params.show === "done"}>
              Done
            </SegmentLink>
          </Segmented>
          <HomeworkSearch q={params.q} hidden={hidden} clearHref={link(path, { ...params, q: "" })} />
        </div>
      </header>

      {params.show === "todo" ? (
        <TodoView items={items} params={params} now={now} board={board} />
      ) : (
        <DoneView items={items} params={params} board={board} />
      )}
    </div>
  );
}

function TodoView({
  items,
  params,
  now,
  board,
}: {
  items: StudentHomeworkListItem[];
  params: BoardParams;
  now: Date;
  board: Board;
}) {
  const { dueThisWeek, overdue, comingUp } = buildTodoBoard(items, params, now);
  if (dueThisWeek.length + overdue.length + comingUp.length === 0) {
    return (
      <Frame title="To do">
        <EmptyPanel>
          {params.q ? "Nothing matches this search." : "All caught up - nothing to do."}
        </EmptyPanel>
      </Frame>
    );
  }

  const shownOverdue = params.older ? overdue : overdue.slice(0, OVERDUE_PREVIEW);
  const hiddenCount = overdue.length - shownOverdue.length;
  const tutor = soleTutor(overdue);
  const href = (id: string) => board.link(`${board.path}/${id}`, params);

  return (
    <>
      <Frame title="Due this week">
        {dueThisWeek.length === 0 ? (
          <EmptyPanel>Nothing due this week.</EmptyPanel>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {dueThisWeek.map((item) => (
              <li key={item.id}>
                <DueCard item={item} href={href(item.id)} now={now} viewer={board.viewer} />
              </li>
            ))}
          </ul>
        )}
      </Frame>

      {overdue.length > 0 && (
        <Frame
          title={
            <>
              Overdue
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-bad-bg px-2 text-[13px] font-extrabold tabular-nums text-bad">
                {overdue.length}
              </span>
            </>
          }
          action={
            tutor ? (
              <Link href={`${board.messages}/with/${tutor.id}`} className={LINE_BUTTON}>
                Ask {tutor.firstName} which still count
              </Link>
            ) : (
              <Link href={board.messages} className={LINE_BUTTON}>
                {board.viewer.kind === "student"
                  ? "Ask your tutors which still count"
                  : "Ask the tutors which still count"}
              </Link>
            )
          }
        >
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-[#EFF0F5]">
              {shownOverdue.map((item) => (
                <li key={item.id}>
                  <CompactRow
                    item={item}
                    href={href(item.id)}
                    right={<span className="text-bad">{overdueAge(new Date(item.dueDate), now)}</span>}
                    rightLabel="Overdue by"
                  />
                </li>
              ))}
            </ul>
            {overdue.length > OVERDUE_PREVIEW && (
              <Link
                href={board.link(board.path, { ...params, older: !params.older })}
                scroll={false}
                className="flex h-12 items-center justify-center border-t border-[#EFF0F5] bg-[#FAFAFD] text-[14px] font-bold text-ink transition-colors hover:bg-[#F3F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
              >
                {params.older
                  ? "Show fewer"
                  : `Show ${hiddenCount} older · back to ${dayMonthFmt.format(new Date(overdue[overdue.length - 1].dueDate))}`}
              </Link>
            )}
          </div>
        </Frame>
      )}

      {comingUp.length > 0 && (
        <Frame title="Coming up">
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-[#EFF0F5]">
              {comingUp.map((item) => (
                <li key={item.id}>
                  <CompactRow
                    item={item}
                    href={href(item.id)}
                    right={formatHomeworkDate(new Date(item.dueDate))}
                    rightLabel="Due"
                  />
                </li>
              ))}
            </ul>
          </div>
        </Frame>
      )}
    </>
  );
}

function DoneView({
  items,
  params,
  board,
}: {
  items: StudentHomeworkListItem[];
  params: BoardParams;
  board: Board;
}) {
  const { waiting, marked } = buildDoneBoard(items, params);
  const href = (id: string) => board.link(`${board.path}/${id}`, params);
  if (waiting.length + marked.length === 0) {
    return (
      <Frame title="Done">
        <EmptyPanel>{params.q ? "Nothing matches this search." : "Nothing handed in yet."}</EmptyPanel>
      </Frame>
    );
  }

  return (
    <>
      {waiting.length > 0 && (
        <Frame title="Waiting for marking">
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-[#EFF0F5]">
              {waiting.map((item) => (
                <li key={item.id}>
                  <CompactRow
                    item={item}
                    href={href(item.id)}
                    right={formatHomeworkDate(new Date(item.submittedAt ?? item.dueDate))}
                    rightLabel={item.status === "late" ? "Submitted late" : "Submitted"}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Frame>
      )}
      {marked.length > 0 && (
        <Frame title="Marked">
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-[#EFF0F5]">
              {marked.map((item) => (
                <li key={item.id}>
                  <CompactRow
                    item={item}
                    href={href(item.id)}
                    right={
                      item.score !== null ? (
                        <span className="text-good">{formatScore(item.score)}</span>
                      ) : (
                        "Marked"
                      )
                    }
                    rightLabel={item.score !== null ? "Score" : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        </Frame>
      )}
    </>
  );
}

const LINE_BUTTON =
  "inline-flex h-10 shrink-0 items-center rounded-[12px] bg-white px-4 text-[14px] font-bold text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition-colors duration-150 hover:bg-[#F5F6FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

/** A glass frame with its heading inside the top edge, holding white content. */
function Frame({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass flex flex-col gap-1.5 rounded-[24px] p-1.5">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-1.5 pl-4 pr-1.5">
        <h2 className="flex items-center gap-2.5 text-[19px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return <p className="panel px-5 py-8 text-center text-[14px] font-semibold text-ink-soft">{children}</p>;
}

function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-[16px] bg-white/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </nav>
  );
}

function SegmentLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[12px] px-3.5 text-[14px] font-bold transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        active ? "bg-ink text-white" : "text-ink hover:bg-white",
      )}
    >
      {children}
    </Link>
  );
}

function SubjectLine({ item, className }: { item: StudentHomeworkListItem; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2 text-[14px] font-medium text-ink-soft", className)}>
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: item.subjectName
            ? subjectTone(item.subjectName, item.subjectColor).dot
            : "var(--muted-2)",
        }}
      />
      <span className="truncate">{item.subjectName ?? item.className ?? "Independent task"}</span>
    </span>
  );
}

function Chip({ tone, children }: { tone: "plain" | "warn"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-[8px] px-2 text-[11px] font-extrabold uppercase tracking-[0.06em]",
        tone === "warn" ? "bg-warn-bg text-warn" : "bg-surface-3 text-ink",
      )}
    >
      {children}
    </span>
  );
}

/** A homework due this week: date block, title, subject, how soon, Start. */
function DueCard({
  item,
  href,
  now,
  viewer,
}: {
  item: StudentHomeworkListItem;
  href: string;
  now: Date;
  viewer: HomeworkBoardViewer;
}) {
  const due = new Date(item.dueDate);
  const days = daysUntil(due, now);
  const urgency = days <= 0 ? "text-bad" : days <= 3 ? "text-warn" : "text-ink";
  const resubmit = item.status === "resubmission_requested";

  return (
    <Link
      href={href}
      className="panel group flex items-center gap-4 px-4 py-3.5 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(16,24,40,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-5 sm:px-6"
    >
      <span className="flex w-10 shrink-0 flex-col items-center leading-none">
        <span className={cn("text-[12px] font-extrabold uppercase tracking-[0.04em]", urgency === "text-ink" ? "text-ink-soft" : urgency)}>
          {weekdayFmt.format(due)}
        </span>
        <span className="mt-1 text-[26px] font-extrabold tabular-nums text-ink">{dayFmt.format(due)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[17px] font-extrabold text-ink">{item.title}</span>
        <span className="flex min-w-0 items-center gap-2">
          <SubjectLine item={item} />
          {item.isTest && <Chip tone="plain">Test</Chip>}
          {resubmit && <Chip tone="warn">Resubmit</Chip>}
        </span>
      </span>
      <span className={cn("hidden shrink-0 text-[15px] font-bold sm:block", urgency)}>
        {dueStatus(due, now).short}
      </span>
      <span className="inline-flex h-11 shrink-0 items-center rounded-[12px] bg-ink px-5 text-[15px] font-extrabold text-white transition-colors group-hover:bg-[#2a2d45]">
        {viewer.kind === "parent" ? "View" : resubmit ? "Resubmit" : "Start"}
      </span>
    </Link>
  );
}

/** One compact list row: subject dot, title, subject, and a right-hand value. */
function CompactRow({
  item,
  href,
  right,
  rightLabel,
}: {
  item: StudentHomeworkListItem;
  href: string;
  right: ReactNode;
  /** Read before the value by screen readers ("Overdue by 10 weeks"). */
  rightLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[54px] items-center gap-3.5 px-4 py-2.5 transition-colors duration-150 hover:bg-[#F7F8FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 sm:px-6"
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          backgroundColor: item.subjectName
            ? subjectTone(item.subjectName, item.subjectColor).dot
            : "var(--muted-2)",
        }}
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-[15px] font-bold text-ink">{item.title}</span>
        {item.isTest && <Chip tone="plain">Test</Chip>}
      </span>
      <span className="hidden max-w-[200px] shrink-0 truncate text-[14px] font-medium text-ink-soft sm:block">
        {item.subjectName ?? item.className ?? "Independent task"}
      </span>
      <span className="w-[84px] shrink-0 text-right text-[14px] font-bold tabular-nums text-ink">
        {rightLabel && <span className="sr-only">{rightLabel} </span>}
        {right}
      </span>
    </Link>
  );
}
