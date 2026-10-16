import type { ReactNode } from "react";
import Link from "next/link";
import { Empty, GlassPanel, Pill, SubjectDot, type PillTone } from "@/components/admin/ui";
import type { QuizListRow } from "@/lib/quiz-queries";
import { groupQuizzesBySubject } from "@/lib/quiz-list";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { cn } from "@/lib/utils";

/*
 * The admin quiz list pieces: the queue card for quizzes waiting on review,
 * and the all-quizzes table grouped by subject.
 */

export const quizDateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Question count as a tinted tile, so a queue shows how much work each quiz
 *  is before you open it. */
export function QuestionCountTile({ count }: { count: number }) {
  return (
    <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-surface leading-[1.05]">
      <span className="text-[16px] font-extrabold tabular-nums text-ink" aria-hidden>
        {count}
      </span>
      <span className="text-[10px] font-extrabold text-muted" aria-hidden>
        Qs
      </span>
      <span className="sr-only">
        {count} question{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}

/**
 * Quizzes waiting on the viewer (admin: to review),
 * as a glass panel with a count badge and one card per quiz.
 */
export function QuizQueue({
  title,
  titleId,
  rows,
  hrefFor,
  meta,
  note,
  actions,
}: {
  title: string;
  titleId: string;
  rows: QuizListRow[];
  hrefFor: (row: QuizListRow) => string;
  meta: (row: QuizListRow) => ReactNode;
  note?: (row: QuizListRow) => ReactNode;
  actions: (row: QuizListRow) => ReactNode;
}) {
  return (
    <GlassPanel
      title={
        <span className="inline-flex items-center gap-2">
          {title}
          <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-ink px-1.5 text-[12px] font-extrabold tabular-nums text-white">
            {rows.length}
          </span>
        </span>
      }
      titleId={titleId}
    >
      <ul
        className="grid gap-2 p-2"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))" }}
      >
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-[12px] bg-surface-2 p-3"
          >
            <QuestionCountTile count={r.questionCount} />
            <div className="min-w-0 flex-1 basis-[180px]">
              <Link
                href={hrefFor(r)}
                className="block truncate text-[14px] font-extrabold text-ink transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {r.title}
              </Link>
              <p className="mt-0.5 text-[12px] text-muted">{meta(r)}</p>
              {note?.(r)}
            </div>
            <div className="flex shrink-0 items-start gap-2">{actions(r)}</div>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

/**
 * Every quiz the viewer can see, in one table with a header row per subject.
 * `hasAny` is whether any quiz exists before filtering: the table (and the
 * filters on its title row) stays up whenever it does, so an over-narrow
 * filter never strips away the controls that undo it.
 */
export function QuizTable({
  rows,
  hasAny,
  emptyState,
  filters,
  hrefFor,
  author,
  actions,
}: {
  rows: QuizListRow[];
  hasAny: boolean;
  emptyState: ReactNode;
  filters?: ReactNode;
  hrefFor: (row: QuizListRow) => string;
  /** Adds an Author column. */
  author?: (row: QuizListRow) => string;
  actions: (row: QuizListRow) => ReactNode;
}) {
  const groups = groupQuizzesBySubject(rows);
  const columns = author ? 5 : 4;
  return (
    <GlassPanel
      title="All quizzes"
      titleId="all-quizzes-heading"
      action={hasAny ? filters : undefined}
    >
      {!hasAny ? (
        emptyState
      ) : (
        <div className="overflow-x-auto">
          <table className={cn("w-full border-collapse", author ? "min-w-[760px]" : "min-w-[640px]")}>
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <Th className="pl-4">Quiz</Th>
                <Th>Week</Th>
                <Th>Status</Th>
                {author && <Th>Author</Th>}
                <Th className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            {groups.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={columns} className="border-t border-line">
                    <Empty>No quizzes match these filters.</Empty>
                  </td>
                </tr>
              </tbody>
            ) : (
              // One tbody per subject: the group header is the subject, so
              // the rows under it carry the week only.
              groups.map(([subjectName, subjectRows]) => (
                <tbody key={subjectName}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={columns}
                      className="border-t border-line bg-surface-2 px-4 pb-2 pt-2.5 text-left text-[12px] font-extrabold text-ink"
                    >
                      <span className="inline-flex items-center gap-2">
                        <SubjectDot
                          subject={subjectName}
                          color={subjectRows[0]?.subjectColor ?? null}
                        />
                        {subjectName}
                      </span>
                    </th>
                  </tr>
                  {subjectRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-line transition-colors hover:bg-surface-2/70"
                    >
                      <Td className="pl-4">
                        <Link
                          href={hrefFor(r)}
                          className="text-[14px] font-bold text-ink transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                        >
                          {r.title}
                        </Link>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {r.questionCount} question{r.questionCount === 1 ? "" : "s"} ·{" "}
                          <span className="tabular-nums">{quizDateFmt.format(r.updatedAt)}</span>
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-soft">
                        Term {r.termNumber}, Week {r.weekNumber}
                      </Td>
                      <Td>
                        <Pill tone={(QUIZ_STATUS_TONE[r.status] ?? "default") as PillTone}>
                          {QUIZ_STATUS_LABEL[r.status] ?? r.status}
                        </Pill>
                      </Td>
                      {author && <Td className="text-ink-soft">{author(r)}</Td>}
                      <Td className="pr-4">
                        <div className="flex items-start justify-end gap-2">{actions(r)}</div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              ))
            )}
          </table>
        </div>
      )}
    </GlassPanel>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-2.5 py-3 text-left font-extrabold", className)}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("px-2.5 py-3 align-middle text-[13px] text-ink", className)}>
      {children}
    </td>
  );
}
