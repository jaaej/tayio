import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canTutorViewQuiz, getQuizWithContent } from "@/lib/quiz-queries";
import { QuizMaker } from "@/components/quiz/quiz-maker";

export const dynamic = "force-dynamic";

export default async function TutorQuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("tutor");
  const { id } = await params;
  const content = await getQuizWithContent(id);
  if (!content || !(await canTutorViewQuiz(user.id, content.quiz))) notFound();

  const { quiz, questions } = content;
  const editable = quiz.status === "requested" || quiz.status === "changes_requested";

  return (
    <QuizMaker
      quiz={quiz}
      questions={questions}
      attachments={content.attachments}
      editable={editable}
      canEditTitle={editable}
      canSubmit={editable}
      canApprove={false}
      hrefBack="/tutor/quizzes"
      backLabel="Back to quizzes"
      note={
        quiz.note
          ? {
              label:
                quiz.status === "changes_requested"
                  ? "Changes requested"
                  : "Instructions from admin",
              text: quiz.note,
            }
          : null
      }
    />
  );
}
