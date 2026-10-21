import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getQuizWithContent } from "@/lib/quiz-queries";
import { QuizMaker } from "@/components/quiz/quiz-maker";
import { quizNotes } from "@/lib/quiz-notes";
import { ReviewControls } from "./_components/review-controls";
import { MajorQuizToggle } from "./_components/major-quiz-toggle";

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
    <QuizMaker
      quiz={quiz}
      questions={questions}
      attachments={content.attachments}
      editable
      canEditTitle
      canSubmit={false}
      canApprove={quiz.status === "draft" || quiz.status === "pending_review"}
      hrefBack={`/admin/subjects/${quiz.subjectId}/curriculum?term=${quiz.termId}&week=${quiz.subjectWeekId}`}
      backLabel="Back to curriculum week"
      headerActions={
        <>
          <MajorQuizToggle quizId={quiz.id} isMajor={quiz.isMajor} />
          {quiz.status === "pending_review" && <ReviewControls quizId={quiz.id} />}
        </>
      }
      notes={quizNotes(quiz)}
    />
  );
}
