import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  listQuizzesForAdmin,
  listQuizTargets,
  listTermTestTargets,
  type QuizListRow,
} from "@/lib/quiz-queries";
import { Card, CardHead, CardBody, PageHeader, Pill, Empty, type PillTone } from "@/components/admin/ui";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE, quizSubjectPeriodLabel } from "@/lib/quiz-status";
import { NewQuizForm } from "./_components/new-quiz-form";
import { RequestQuizForm } from "./_components/request-quiz-form";
import { NewTermTestForm } from "./_components/new-term-test-form";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function QuizTable({ rows, periodColumnLabel }: { rows: QuizListRow[]; periodColumnLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-muted font-bold">
            <th className="text-left px-5 py-2.5">Title</th>
            <th className="text-left px-5 py-2.5">{periodColumnLabel}</th>
            <th className="text-left px-5 py-2.5">Status</th>
            <th className="text-left px-5 py-2.5">Assigned tutor</th>
            <th className="text-left px-5 py-2.5">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-line last:border-b-0 hover:bg-surface-2 transition-colors"
            >
              <td className="px-5 py-3 text-[13px]">
                <Link
                  href={`/admin/quizzes/${r.id}`}
                  className="font-bold text-ink hover:text-brand-700 hover:underline"
                >
                  {r.title}
                </Link>
              </td>
              <td className="px-5 py-3 text-[13px] text-ink-soft">
                {quizSubjectPeriodLabel(r)}
              </td>
              <td className="px-5 py-3">
                <Pill tone={(QUIZ_STATUS_TONE[r.status] ?? "default") as PillTone} dot>
                  {QUIZ_STATUS_LABEL[r.status] ?? r.status}
                </Pill>
              </td>
              <td className="px-5 py-3 text-[13px] text-ink-soft">
                {r.assignedTutorName ?? "Unassigned"}
              </td>
              <td className="px-5 py-3 text-[13px] text-muted tabular-nums">
                {dateFmt.format(r.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminQuizzesPage() {
  await requireRole("admin");

  const [rows, targets, termTestTargets] = await Promise.all([
    listQuizzesForAdmin(),
    listQuizTargets(),
    listTermTestTargets(),
  ]);
  const weeklyRows = rows.filter((r) => r.kind === "weekly");
  const termTestRows = rows.filter((r) => r.kind === "term_test");

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        eyebrow="Curriculum"
        title="Quizzes"
        sub="Author a quiz directly or request one from a tutor, then review before approving."
        actions={
          <Pill tone="brand">
            {rows.length} {rows.length === 1 ? "quiz" : "quizzes"}
          </Pill>
        }
      />

      <section className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardHead title="New quiz" eyebrow="Admin-authored" />
          <CardBody>
            <NewQuizForm weeks={targets.weeks} />
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Request from a tutor" eyebrow="Tutor-authored" />
          <CardBody>
            <RequestQuizForm tutors={targets.tutors} weeks={targets.weeks} />
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHead title="Create term test" eyebrow="Term-scoped" />
        <CardBody>
          <NewTermTestForm tutors={termTestTargets.tutors} slots={termTestTargets.slots} />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Weekly quizzes" eyebrow={`${weeklyRows.length} total`} />
        {weeklyRows.length === 0 ? (
          <Empty>No weekly quizzes yet - create one above.</Empty>
        ) : (
          <QuizTable rows={weeklyRows} periodColumnLabel="Subject & week" />
        )}
      </Card>

      <Card>
        <CardHead title="Term tests" eyebrow={`${termTestRows.length} total`} />
        {termTestRows.length === 0 ? (
          <Empty>No term tests yet - create one above.</Empty>
        ) : (
          <QuizTable rows={termTestRows} periodColumnLabel="Subject & term" />
        )}
      </Card>
    </div>
  );
}
