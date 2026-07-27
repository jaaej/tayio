import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import { requireRole } from "@/lib/auth";
import { canTutorViewQuiz, getQuizWithContent } from "@/lib/quiz-queries";
import { QuizMaker } from "@/components/quiz/quiz-maker";
import { Pill } from "@/components/student/pill";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";

export const dynamic = "force-dynamic";

type Tone = NonNullable<ComponentProps<typeof Pill>["tone"]>;

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
    <div className="max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          {quiz.subjectName} - {quiz.termYear} Term {quiz.termNumber}, Week{" "}
          {quiz.weekNumber}
        </div>
        <Pill tone={(QUIZ_STATUS_TONE[quiz.status] ?? "neutral") as Tone} dot>
          {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
        </Pill>
      </div>

      {quiz.note && (
        <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
            {quiz.status === "changes_requested" ? "Changes requested" : "Instructions from admin"}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-soft">{quiz.note}</p>
        </div>
      )}

      <QuizMaker
        quiz={quiz}
        questions={questions}
        attachments={content.attachments}
        editable={editable}
        canEditTitle={editable}
        canSubmit={editable}
        canApprove={false}
        hrefBack="/tutor/quizzes"
      />
    </div>
  );
}
