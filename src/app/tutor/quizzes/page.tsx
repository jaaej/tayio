import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listQuizzesForTutor, type QuizListRow } from "@/lib/quiz-queries";
import { tutorQuizAction, tutorQuizBuckets } from "@/lib/quiz-list";
import { Empty, PageHeader, buttonVariants } from "@/components/admin/ui";
import { QuizFilters } from "@/components/quizzes/quiz-filters";
import { QuizQueue, QuizTable, quizDateFmt } from "@/components/quizzes/quiz-list";
import { TUTOR_QUIZ_TODO_STATUSES } from "../_lib/nav-badges";

export const dynamic = "force-dynamic";

const BUCKETS = tutorQuizBuckets(TUTOR_QUIZ_TODO_STATUSES);
const STATUS_PILLS = [
  { value: "", label: "All" },
  ...BUCKETS.map((b) => ({ value: b.value, label: b.label })),
];
const isTodo = (row: QuizListRow) =>
  (TUTOR_QUIZ_TODO_STATUSES as readonly string[]).includes(row.status);

const hrefFor = (row: QuizListRow) => `/tutor/quizzes/${row.id}`;

/**
 * Quizzes a tutor writes on request: the ones waiting on them (requested or
 * sent back with changes) first, then every quiz they can see - their own,
 * plus live quizzes in the subjects they teach - grouped by subject.
 */
export default async function TutorQuizzesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; subject?: string }>;
}) {
  const user = await requireRole("tutor");
  const sp = await searchParams;
  const rows = await listQuizzesForTutor(user.id);

  const bucket = BUCKETS.find((b) => b.value === sp.status) ?? null;
  const query = (sp.q ?? "").trim().toLowerCase();
  const subjectNames = Array.from(new Set(rows.map((r) => r.subjectName))).sort((a, b) =>
    a.localeCompare(b),
  );
  const subject = subjectNames.includes(sp.subject ?? "") ? sp.subject! : "";

  // The To do card reads the whole set: a search box should not hide work
  // that is waiting on the tutor. Sent-back quizzes come first.
  const todo = rows
    .filter((r) => r.assignedTutorId === user.id && isTodo(r))
    .sort(
      (a, b) =>
        Number(b.status === "changes_requested") - Number(a.status === "changes_requested"),
    );

  const listed = rows.filter(
    (r) =>
      (!bucket || bucket.statuses.includes(r.status)) &&
      (!subject || r.subjectName === subject) &&
      (!query || r.title.toLowerCase().includes(query)),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Quizzes"
        sub="Admin asks you for a quiz when a week needs one. When you submit it, it goes back to admin for review."
      />

      {todo.length > 0 && (
        <QuizQueue
          title="To do"
          titleId="quiz-todo-heading"
          rows={todo}
          hrefFor={hrefFor}
          meta={(r) => (
            <>
              {r.subjectName} · Term {r.termNumber}, Week {r.weekNumber} ·{" "}
              <span className="tabular-nums">{quizDateFmt.format(r.updatedAt)}</span>
            </>
          )}
          note={(r) =>
            r.note ? (
              <p
                className={
                  r.status === "changes_requested"
                    ? "mt-0.5 text-[12px] font-semibold text-bad"
                    : "mt-0.5 text-[12px] font-semibold text-info"
                }
              >
                {r.status === "changes_requested" ? "Changes requested" : "Admin"}: {r.note}
              </p>
            ) : null
          }
          actions={(r) => (
            <Link href={hrefFor(r)} className={buttonVariants({ variant: "primary", size: "md" })}>
              {tutorQuizAction(r)}
            </Link>
          )}
        />
      )}

      <QuizTable
        rows={listed}
        hasAny={rows.length > 0}
        filters={<QuizFilters statuses={STATUS_PILLS} subjects={subjectNames} />}
        emptyState={
          <Empty>An admin will ask you for a quiz when a week needs one.</Empty>
        }
        hrefFor={hrefFor}
        actions={(r) => (
          <Link href={hrefFor(r)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {r.assignedTutorId === user.id && isTodo(r) ? "Edit quiz" : "View"}
          </Link>
        )}
      />
    </div>
  );
}
