import type { ReactNode } from "react";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  listQuizzesForAdmin,
  listQuizTargets,
  type QuizListRow,
} from "@/lib/quiz-queries";
import {
  PageHeader,
  Pill,
  Empty,
  SubjectDot,
  buttonVariants,
  type PillTone,
} from "@/components/admin/ui";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { cn } from "@/lib/utils";
import { ApproveQuizButton } from "./_components/approve-quiz-button";
import { NewQuizPanel } from "./_components/new-quiz-panel";
import { QuizFilters } from "./_components/quiz-filters";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const STATUS_PILLS = [
  { value: "", label: "All" },
  { value: "pending_review", label: "Pending review" },
  { value: "draft", label: "Drafts" },
  { value: "approved", label: "Approved" },
  { value: "admin", label: "Admin" },
];

const STATUS_VALUES = STATUS_PILLS.map((p) => p.value).filter(Boolean);

/**
 * A requested quiz is authored by the tutor it was assigned to; an
 * admin-written one by whoever created it. Falling through in that order lands
 * on the person responsible for the content in both cases. `created_by` is NOT
 * NULL, so this is always a real name.
 */
function authorOf(row: QuizListRow): string {
  return row.assignedTutorName ?? row.createdByName;
}

/**
 * Rows arrive most-recently-updated first. Bucketing preserves that inside each
 * subject, and the buckets themselves go alphabetical - a subject list has no
 * meaningful recency order, and A-Z is the one a reader can predict.
 */
function groupBySubject(rows: QuizListRow[]): [string, QuizListRow[]][] {
  const bySubject = new Map<string, QuizListRow[]>();
  for (const row of rows) {
    const list = bySubject.get(row.subjectName) ?? [];
    list.push(row);
    bySubject.set(row.subjectName, list);
  }
  return Array.from(bySubject.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
}

export default async function AdminQuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; subject?: string }>;
}) {
  await requireRole("admin");

  const sp = await searchParams;
  const status = STATUS_VALUES.includes(sp.status ?? "") ? sp.status : null;
  const query = (sp.q ?? "").trim().toLowerCase();

  const [rows, targets] = await Promise.all([
    listQuizzesForAdmin(),
    listQuizTargets(),
  ]);

  // Options come off the full set, not the filtered slice, so the dropdown can
  // always move you to another subject instead of stranding you on an empty one.
  const subjectNames = Array.from(
    new Set(rows.map((r) => r.subjectName)),
  ).sort((a, b) => a.localeCompare(b));
  const subject = subjectNames.includes(sp.subject ?? "") ? sp.subject! : "";

  // Review queue reads the whole set, not the filtered slice: it is the work
  // waiting on this admin, and a search box should not hide it.
  const awaitingReview = rows.filter((r) => r.status === "pending_review");

  const listed = rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!subject || r.subjectName === subject) &&
      (!query || r.title.toLowerCase().includes(query)),
  );
  const groups = groupBySubject(listed);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: "/admin/classes", label: "Back to classes" }}
        title="Quizzes"
        actions={
          <NewQuizPanel
            tutors={targets.tutors}
            weeks={targets.weeks}
            triggerSize="lg"
          />
        }
      />

      {awaitingReview.length > 0 && (
        <GlassPanel
          title={
            <span className="inline-flex items-center gap-2">
              Waiting on you
              <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-ink px-1.5 text-[12px] font-extrabold tabular-nums text-white">
                {awaitingReview.length}
              </span>
            </span>
          }
          titleId="waiting-heading"
        >
          <ul
            className="grid gap-2 p-2"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(360px, 100%), 1fr))",
            }}
          >
            {awaitingReview.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-[12px] bg-surface-2 p-3"
              >
                <QuestionCountTile count={r.questionCount} />
                <div className="min-w-0 flex-1 basis-[180px]">
                  <Link
                    href={`/admin/quizzes/${r.id}`}
                    className="block truncate text-[14px] font-extrabold text-ink transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    {r.title}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {r.subjectName} · Term {r.termNumber}, Week {r.weekNumber}{" "}
                    · by {authorOf(r)} ·{" "}
                    <span className="tabular-nums">
                      {dateFmt.format(r.updatedAt)}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <Link
                    href={`/admin/quizzes/${r.id}`}
                    className={buttonVariants({ variant: "outline", size: "md" })}
                  >
                    Review
                  </Link>
                  <ApproveQuizButton quizId={r.id} />
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      <GlassPanel
        title="All quizzes"
        titleId="all-quizzes-heading"
        action={
          rows.length > 0 ? (
            <QuizFilters statuses={STATUS_PILLS} subjects={subjectNames} />
          ) : undefined
        }
      >
        {rows.length === 0 ? (
          <Empty className="flex flex-col items-center gap-4">
            No quizzes yet.
            <NewQuizPanel
              tutors={targets.tutors}
              weeks={targets.weeks}
              triggers="new"
              triggerSize="lg"
            />
          </Empty>
        ) : (
          // The table always renders once any quiz exists, so an over-narrow
          // filter never strips away the controls that undo it.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <Th className="pl-4">Quiz</Th>
                  <Th>Week</Th>
                  <Th>Status</Th>
                  <Th>Author</Th>
                  <Th className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              {groups.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={5} className="border-t border-line">
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
                        colSpan={5}
                        className="border-t border-line bg-surface-2 px-4 pb-2 pt-2.5 text-left text-[12px] font-extrabold text-ink"
                      >
                        <span className="inline-flex items-center gap-2">
                          <SubjectDot subject={subjectName} />
                          {subjectName}
                        </span>
                      </th>
                    </tr>
                    {subjectRows.map((r) => (
                      <QuizRow key={r.id} row={r} />
                    ))}
                  </tbody>
                ))
              )}
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function QuizRow({ row: r }: { row: QuizListRow }) {
  return (
    <tr className="border-t border-line transition-colors hover:bg-surface-2/70">
      <Td className="pl-4">
        <Link
          href={`/admin/quizzes/${r.id}`}
          className="text-[14px] font-bold text-ink transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {r.title}
        </Link>
        <div className="mt-0.5 text-[12px] text-muted">
          {r.questionCount} question{r.questionCount === 1 ? "" : "s"} ·{" "}
          <span className="tabular-nums">{dateFmt.format(r.updatedAt)}</span>
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
      <Td className="text-ink-soft">{authorOf(r)}</Td>
      <Td className="pr-4">
        <div className="flex items-start justify-end gap-2">
          {r.status === "pending_review" && (
            <ApproveQuizButton quizId={r.id} size="sm" />
          )}
          <Link
            href={`/admin/quizzes/${r.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Edit quiz
          </Link>
        </div>
      </Td>
    </tr>
  );
}

/** Question count as a tinted tile, so the review queue shows how much work
 *  each submission is before you open it. */
function QuestionCountTile({ count }: { count: number }) {
  return (
    <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-surface leading-[1.05]">
      <span
        className="text-[16px] font-extrabold tabular-nums text-ink"
        aria-hidden
      >
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

function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th scope="col" className={cn("px-2.5 py-3 text-left font-extrabold", className)}>{children}</th>
  );
}

function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-2.5 py-3 align-middle text-[13px] text-ink", className)}>
      {children}
    </td>
  );
}
