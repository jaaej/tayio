import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  listQuizzesForAdmin,
  listQuizTargets,
  type QuizListRow,
} from "@/lib/quiz-queries";
import { PageHeader, Empty, buttonVariants } from "@/components/admin/ui";
import { QuizFilters } from "@/components/quizzes/quiz-filters";
import { QuizQueue, QuizTable, quizDateFmt } from "@/components/quizzes/quiz-list";
import { ApproveQuizButton } from "./_components/approve-quiz-button";
import { NewQuizPanel } from "./_components/new-quiz-panel";

export const dynamic = "force-dynamic";

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

const hrefFor = (row: QuizListRow) => `/admin/quizzes/${row.id}`;

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
        <QuizQueue
          title="Waiting on you"
          titleId="waiting-heading"
          rows={awaitingReview}
          hrefFor={hrefFor}
          meta={(r) => (
            <>
              {r.subjectName} · Term {r.termNumber}, Week {r.weekNumber} · by{" "}
              {authorOf(r)} ·{" "}
              <span className="tabular-nums">{quizDateFmt.format(r.updatedAt)}</span>
            </>
          )}
          actions={(r) => (
            <>
              <Link
                href={hrefFor(r)}
                className={buttonVariants({ variant: "outline", size: "md" })}
              >
                Review
              </Link>
              <ApproveQuizButton quizId={r.id} />
            </>
          )}
        />
      )}

      <QuizTable
        rows={listed}
        hasAny={rows.length > 0}
        filters={<QuizFilters statuses={STATUS_PILLS} subjects={subjectNames} />}
        emptyState={
          <Empty className="flex flex-col items-center gap-4">
            No quizzes yet.
            <NewQuizPanel
              tutors={targets.tutors}
              weeks={targets.weeks}
              triggers="new"
              triggerSize="lg"
            />
          </Empty>
        }
        hrefFor={hrefFor}
        author={authorOf}
        actions={(r) => (
          <>
            {r.status === "pending_review" && (
              <ApproveQuizButton quizId={r.id} size="sm" />
            )}
            <Link
              href={hrefFor(r)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Edit quiz
            </Link>
          </>
        )}
      />
    </div>
  );
}
