import { notFound } from "next/navigation";
import { Clock3, Hourglass } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getStudentTermTest } from "@/lib/quiz-queries";
import { getStudentTermTestResults } from "@/lib/term-test-results";
import { deriveTermTestState } from "@/lib/term-test";
import { TermTestTakeForm } from "./_components/take-form";
import { TermTestStatusCard } from "./_components/status-card";
import { TermTestResultsView } from "./_components/results-view";

const releaseFmt = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function StudentTermTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("student");
  const { id: quizId } = await params;

  const content = await getStudentTermTest(user.id, quizId);
  if (!content) notFound();

  const hrefBack = `/student/subjects/${content.quiz.subjectId}?term=${content.quiz.termId}`;

  // getStudentTermTest only ever returns quizzes with status "approved" -
  // the "not_open" branch below is unreachable through this data path but
  // kept for completeness against deriveTermTestState's full state space.
  const state = deriveTermTestState({
    status: "approved",
    resultsReleaseAt: content.quiz.resultsReleaseAt,
    now: new Date(),
    hasAttempt: content.hasAttempt,
  });

  if (state === "not_open") {
    return (
      <TermTestStatusCard
        icon={Clock3}
        title="This term test isn't open yet"
        message="Check back once your tutor opens it - you'll see it here as soon as it's ready to take."
        hrefBack={hrefBack}
        subjectName={content.quiz.subjectName}
      />
    );
  }

  if (state === "open") {
    return <TermTestTakeForm content={content} hrefBack={hrefBack} />;
  }

  if (state === "submitted_pending") {
    return (
      <TermTestStatusCard
        icon={Hourglass}
        title="Submitted"
        message={`Results release after ${releaseFmt.format(content.quiz.resultsReleaseAt)}. Come back then to see your score, rank, and corrections.`}
        hrefBack={hrefBack}
        subjectName={content.quiz.subjectName}
      />
    );
  }

  // state === "released"
  const results = await getStudentTermTestResults(user.id, quizId);
  if (!results || !results.released) notFound();

  return (
    <TermTestResultsView
      results={results}
      subjectName={content.quiz.subjectName}
      termYear={content.quiz.termYear}
      termNumber={content.quiz.termNumber}
      hrefBack={hrefBack}
    />
  );
}
