import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import {
  listQuizzesForAdmin,
  listQuizTargets,
  type QuizListRow,
} from "@/lib/quiz-queries";
import {
  Card,
  CardHead,
  PageHeader,
  Pill,
  Empty,
  FilterToolbar,
  type FilterPill,
  type PillTone,
} from "@/components/admin/ui";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { cn } from "@/lib/utils";
import { ApproveQuizButton } from "./_components/approve-quiz-button";
import { NewQuizPanel } from "./_components/new-quiz-panel";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const STATUS_PILLS: FilterPill[] = [
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
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Curriculum"
        title="Quizzes"
        actions={<NewQuizPanel tutors={targets.tutors} weeks={targets.weeks} />}
      />

      {awaitingReview.length > 0 && (
        <section className="rise" style={{ animationDelay: "40ms" }}>
          <Card>
            <CardHead
              title={
                <span className="inline-flex items-center gap-2">
                  Waiting on you
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warn-bg px-1.5 text-[11px] font-extrabold tabular-nums text-warn">
                    {awaitingReview.length}
                  </span>
                </span>
              }
            />
            <ul>
              {awaitingReview.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0"
                >
                  <QuestionCountTile count={r.questionCount} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/quizzes/${r.id}`}
                      className="block truncate text-[14px] font-bold text-ink transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
                    <ButtonLink href={`/admin/quizzes/${r.id}`}>
                      Preview
                    </ButtonLink>
                    <ApproveQuizButton quizId={r.id} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section className="rise" style={{ animationDelay: "80ms" }}>
        <Card>
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
            <>
              {/* Search and status live at the top of the table's own card:
                  they are the table's controls, not a separate surface. */}
              <FilterToolbar
                searchPlaceholder="Search quizzes"
                pillParam="status"
                pills={STATUS_PILLS}
                selectParam="subject"
                selectLabel="Filter by subject"
                selectOptions={[
                  { value: "", label: "All subjects" },
                  ...subjectNames.map((name) => ({
                    value: name,
                    label: name,
                  })),
                ]}
              />
              {/* The table always renders once any quiz exists, so an
                  over-narrow filter never strips away the controls that undo
                  it. */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                      <Th>Quiz</Th>
                      <Th>Week</Th>
                      <Th>Status</Th>
                      <Th>Author</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  {groups.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={5}>
                          <Empty>No quizzes match these filters.</Empty>
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    // One tbody per subject: the group header is the subject,
                    // so the rows under it carry the week only.
                    groups.map(([subjectName, subjectRows]) => (
                      <tbody key={subjectName}>
                        <tr>
                          <th
                            scope="colgroup"
                            colSpan={5}
                            // Same neutral band as the column header, told
                            // apart by weight and contrast rather than a
                            // colour rail: the subject is the darker label,
                            // the column names stay muted.
                            className="border-y border-line bg-surface-2 px-5 py-2 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink"
                          >
                            {subjectName}
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
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

function QuizRow({ row: r }: { row: QuizListRow }) {
  return (
    <tr className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-2">
      <Td>
        <Link
          href={`/admin/quizzes/${r.id}`}
          className="font-bold text-ink transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
        <Pill
          tone={(QUIZ_STATUS_TONE[r.status] ?? "default") as PillTone}
          dot
        >
          {QUIZ_STATUS_LABEL[r.status] ?? r.status}
        </Pill>
      </Td>
      <Td className="text-ink-soft">{authorOf(r)}</Td>
      <Td>
        <div className="flex items-start justify-end gap-2">
          {r.status === "pending_review" && (
            <ApproveQuizButton quizId={r.id} size="sm" />
          )}
          <ButtonLink href={`/admin/quizzes/${r.id}`} size="sm">
            Edit
          </ButtonLink>
          <Link
            href={`/admin/quizzes/${r.id}`}
            aria-label={`Open ${r.title}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-line-strong bg-surface text-ink-soft transition-colors hover:border-brand-400 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
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
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-warn-bg leading-none">
      <span
        className="text-[15px] font-extrabold tabular-nums text-warn"
        aria-hidden
      >
        {count}
      </span>
      <span
        className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-warn"
        aria-hidden
      >
        Qs
      </span>
      <span className="sr-only">
        {count} question{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}

/** Outline `Button` as a link. `Button` renders a real `<button>`, and these
 *  are navigations, so they have to be anchors to keep middle-click, copy-link
 *  and prefetch working. */
function ButtonLink({
  href,
  size = "md",
  children,
}: {
  href: string;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface font-bold text-ink transition-all duration-150",
        "hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        size === "sm" ? "h-8 px-3 text-[12px]" : "h-9 px-4 text-[13px]",
      )}
    >
      {children}
    </Link>
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
    <th className={cn("px-5 py-2.5 text-left", className)}>{children}</th>
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
    <td className={cn("px-5 py-3 align-middle text-[13px] text-ink", className)}>
      {children}
    </td>
  );
}
