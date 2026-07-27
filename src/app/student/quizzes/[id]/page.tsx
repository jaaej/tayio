import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getStudentQuiz } from "@/lib/quiz-queries";
import { StudentPracticeQuiz } from "@/components/quiz/student-practice-quiz";

export const dynamic = "force-dynamic";

export default async function StudentQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("student");
  const { id } = await params;
  const content = await getStudentQuiz(user.id, id);
  if (!content) notFound();

  const { quiz } = content;
  const hrefBack =
    `/student/subjects/${quiz.subjectId}` +
    `?term=${quiz.termId}&week=${quiz.subjectWeekId}`;

  return <StudentPracticeQuiz content={content} hrefBack={hrefBack} />;
}
