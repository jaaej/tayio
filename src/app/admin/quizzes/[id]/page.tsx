import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getQuizWithContent } from "@/lib/quiz-queries";
import { QuizMaker } from "@/components/quiz/quiz-maker";
import { QuizInstructionStrip } from "@/components/quiz/quiz-instruction-strip";
import { Pill, type PillTone } from "@/components/admin/ui";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { ReviewControls } from "./_components/review-controls";

export const dynamic = "force-dynamic";

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
    <div className={quiz.note ? "space-y-5 pb-28" : "space-y-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
          {quiz.subjectName} - {quiz.termYear} Term {quiz.termNumber}, Week{" "}
          {quiz.weekNumber}
        </div>
        <Pill tone={(QUIZ_STATUS_TONE[quiz.status] ?? "default") as PillTone} dot>
          {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
        </Pill>
      </div>

      {quiz.status === "pending_review" && (
        <ReviewControls quizId={quiz.id} status={quiz.status} />
      )}

      <QuizMaker
        quiz={quiz}
        questions={questions}
        attachments={content.attachments}
        editable={quiz.status !== "approved"}
        canEditTitle
        canSubmit={false}
        canApprove={
          quiz.status === "draft" || quiz.status === "pending_review"
        }
        hrefBack="/admin/quizzes"
      />

      {quiz.note && <QuizInstructionStrip label="Note" note={quiz.note} />}
    </div>
  );
}
