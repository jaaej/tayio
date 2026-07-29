import { notFound } from "next/navigation";
import { Hourglass } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getParentTermTestResults } from "@/lib/term-test-results";
import { getTermTestSubjectAndTerm } from "@/lib/quiz-queries";
import { getParentChildren } from "@/app/parent/_data";
import { TermTestStatusCard } from "@/app/student/term-tests/[id]/_components/status-card";
import { TermTestResultsView } from "@/app/student/term-tests/[id]/_components/results-view";

const releaseFmt = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Parent's read-only view of a child's term-test results. All access is
 * gated by `getParentTermTestResults` - it checks the parent-child family
 * link and the child's cohort membership before returning anything, and
 * returns the `{released: false}` shape (no score/rank/corrections/board)
 * until the release date, same as the student page. Nothing on this page
 * fetches the child's data through any other path: the only other query,
 * `getTermTestSubjectAndTerm`, returns non-child-scoped quiz metadata
 * (subject/term labels) and is called only after the gate above passes.
 */
export default async function ParentTermTestResultPage({
  params,
}: {
  params: Promise<{ id: string; childId: string }>;
}) {
  const user = await requireRole("parent");
  const { id: quizId, childId } = await params;

  const results = await getParentTermTestResults(user.id, childId, quizId);
  if (!results) notFound();

  const context = await getTermTestSubjectAndTerm(quizId);
  if (!context) notFound();

  // getParentChildren is already scoped to this parent's familyLinks rows,
  // so a childId that made it past the results gate above is guaranteed to
  // resolve here too; the lookup just gets the child's first name for copy.
  const children = await getParentChildren(user.id);
  const child = children.find((c) => c.id === childId);
  if (!child) notFound();

  const hrefBack = `/parent/subjects/${context.subjectId}?child=${childId}&term=${context.termId}`;

  if (!results.released) {
    return (
      <TermTestStatusCard
        icon={Hourglass}
        title="Not released yet"
        message={`Results release after ${releaseFmt.format(results.resultsReleaseAt)}. Come back then to see ${child.firstName}'s score, rank, and corrections.`}
        hrefBack={hrefBack}
        subjectName={context.subjectName}
      />
    );
  }

  return (
    <TermTestResultsView
      results={results}
      subjectName={context.subjectName}
      termYear={context.termYear}
      termNumber={context.termNumber}
      hrefBack={hrefBack}
      childName={child.firstName}
    />
  );
}
