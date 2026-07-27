import Link from "next/link";
import type { ComponentProps } from "react";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { requireRole } from "@/lib/auth";
import { listQuizzesForTutor, type QuizListRow } from "@/lib/quiz-queries";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";

export const dynamic = "force-dynamic";

type Tone = NonNullable<ComponentProps<typeof Pill>["tone"]>;

function toneFor(status: string): Tone {
  return (QUIZ_STATUS_TONE[status] ?? "neutral") as Tone;
}

const GROUPS: { key: string; heading: string; statuses: string[] }[] = [
  { key: "todo", heading: "To do", statuses: ["requested", "changes_requested"] },
  { key: "submitted", heading: "Submitted", statuses: ["pending_review"] },
  { key: "done", heading: "Done", statuses: ["approved"] },
];

export default async function TutorQuizzesPage() {
  const user = await requireRole("tutor");
  const rows = await listQuizzesForTutor(user.id);

  const groups = GROUPS.map((g) => ({
    ...g,
    rows: rows.filter((r) => g.statuses.includes(r.status)),
  }));
  const totalShown = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <div className="space-y-5">
      <PageHead
        eyebrow="Quiz maker"
        title="Quizzes"
        sub={
          totalShown === 0
            ? "No quizzes assigned to you yet"
            : `${totalShown} quiz${totalShown === 1 ? "" : "zes"} assigned to you`
        }
      />

      {totalShown === 0 ? (
        <Card>
          <CardBody>
            <div className="px-2 py-6 text-sm text-muted text-center">
              An admin will request a quiz from you when one is needed - check back later.
            </div>
          </CardBody>
        </Card>
      ) : (
        groups.map((g) =>
          g.rows.length === 0 ? null : (
            <Card key={g.key}>
              <CardHead title={`${g.heading} (${g.rows.length})`} />
              <CardBody tight>
                <ul className="divide-y divide-line">
                  {g.rows.map((r: QuizListRow) => (
                    <li key={r.id}>
                      <Link
                        href={`/tutor/quizzes/${r.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold text-ink truncate">
                            {r.title}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-muted">
                            {r.subjectName} - Term {r.termNumber}, Week {r.weekNumber}
                          </div>
                        </div>
                        <Pill tone={toneFor(r.status)} dot>
                          {QUIZ_STATUS_LABEL[r.status] ?? r.status}
                        </Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ),
        )
      )}
    </div>
  );
}
