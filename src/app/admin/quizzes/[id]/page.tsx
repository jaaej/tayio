import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getQuizWithContent } from "@/lib/quiz-queries";
import { QuizMaker } from "@/components/quiz/quiz-maker";
import { Pill, type PillTone } from "@/components/admin/ui";
import { ReviewControls } from "./_components/review-controls";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  requested: "Requested",
  pending_review: "Pending review",
  changes_requested: "Changes requested",
  approved: "Approved",
};

const STATUS_TONE: Record<string, PillTone> = {
  draft: "default",
  requested: "info",
  pending_review: "warn",
  changes_requested: "bad",
  approved: "good",
};

export default async function AdminQuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const content = await getQuizWithContent(id);
  if (!content) notFound();

  const { quiz, questions } = content;

  return (
    <div className="space-y-5 max-w-[900px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          {quiz.subjectName} - Week {quiz.weekNumber}
        </div>
        <Pill tone={STATUS_TONE[quiz.status] ?? "default"} dot>
          {STATUS_LABEL[quiz.status] ?? quiz.status}
        </Pill>
      </div>

      {quiz.note && (
        <div className="rounded-[14px] border border-line bg-surface px-4 py-3.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Note</div>
          <p className="mt-1 text-[13px] text-ink-soft whitespace-pre-wrap">{quiz.note}</p>
        </div>
      )}

      {(quiz.status === "pending_review" || quiz.status === "draft") && (
        <ReviewControls quizId={quiz.id} status={quiz.status} />
      )}

      <QuizMaker
        quiz={quiz}
        questions={questions}
        editable={quiz.status !== "approved"}
        canSubmit={false}
        hrefBack="/admin/quizzes"
      />
    </div>
  );
}
