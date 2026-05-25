import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { StatusBadge } from "@/components/data/status-badge";
import { ScoreBadge } from "@/components/data/score-badge";
import { formatDueDate, relativeTime } from "@/lib/format";
import {
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "@/lib/status";
import { markSubmission } from "../../_actions";
import { getHomeworkDetail, requireTutor } from "../../_data";

export default async function HomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tutor = await requireTutor();
  const { homework, submissions } = await getHomeworkDetail(tutor.id, id);

  return (
    <div className="space-y-6">
      <header className="rise space-y-2">
        <Link
          href="/tutor/homework"
          className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-ink"
        >
          ← All homework
        </Link>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink">
          {homework.title}
        </h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          <span>Due {formatDueDate(new Date(homework.dueDate))}</span>
          {homework.allowResubmission && <span>Resubmission allowed</span>}
          {homework.attachmentUrl && (
            <a
              href={homework.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 hover:underline"
            >
              View attachment ↗
            </a>
          )}
        </div>
        {homework.description && (
          <p className="text-sm text-ink-soft max-w-2xl whitespace-pre-wrap pt-2">
            {homework.description}
          </p>
        )}
      </header>

      <Card className="p-0 overflow-hidden rise" style={{ animationDelay: "40ms" }}>
        <div className="px-6 py-5 border-b border-hairline/60 flex items-baseline justify-between">
          <div className="text-xl font-medium text-ink">Submissions</div>
          <span className="text-sm uppercase tracking-[0.18em] text-muted">
            {submissions.length} student{submissions.length === 1 ? "" : "s"}
          </span>
        </div>

        {submissions.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No students assigned yet. Assign to a class to populate this list.
          </div>
        ) : (
          <div className="divide-y divide-hairline/60">
            {submissions.map((s) => (
              <article key={s.studentId} className="px-6 py-5 space-y-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/tutor/students/${s.studentId}`}
                      className="text-lg text-ink hover:underline underline-offset-4"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    {s.yearLevel && (
                      <span className="ml-3 text-sm text-muted">
                        {s.yearLevel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.score !== null && (
                      <ScoreBadge score={String(s.score)} size="sm" />
                    )}
                    <StatusBadge
                      label={HOMEWORK_STATUS_LABEL[s.status] ?? s.status}
                      className={HOMEWORK_STATUS_STYLE[s.status]}
                    />
                  </div>
                </div>

                {s.submittedAt && (
                  <div className="text-sm text-muted">
                    Submitted {relativeTime(s.submittedAt)}
                  </div>
                )}

                {(s.submissionUrl || s.submissionText) && (
                  <div className="rounded-xl border border-hairline/60 bg-brand-50/40 p-4 space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium">
                      Submission
                    </div>
                    {s.submissionText && (
                      <p className="text-sm text-ink whitespace-pre-wrap">
                        {s.submissionText}
                      </p>
                    )}
                    {s.submissionUrl && (
                      <a
                        href={s.submissionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-brand-700 hover:underline"
                      >
                        Open file ↗
                      </a>
                    )}
                  </div>
                )}

                <form action={markSubmission} className="space-y-4">
                  <input type="hidden" name="homeworkId" value={homework.id} />
                  <input type="hidden" name="studentId" value={s.studentId} />

                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`status-${s.studentId}`}>Status</Label>
                      <select
                        id={`status-${s.studentId}`}
                        name="status"
                        defaultValue={s.status}
                        className="h-11 w-full rounded-xl border border-hairline/60 bg-card px-3 text-sm text-ink"
                      >
                        <option value="marked">Marked</option>
                        <option value="returned">Returned</option>
                        <option value="resubmission_requested">Resubmit</option>
                        <option value="submitted">Submitted</option>
                        <option value="late">Late</option>
                        <option value="viewed">Viewed</option>
                        <option value="not_started">Not started</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`score-${s.studentId}`}>
                        Score (optional)
                      </Label>
                      <Input
                        id={`score-${s.studentId}`}
                        name="score"
                        type="number"
                        step="0.01"
                        defaultValue={s.score ?? ""}
                        placeholder="—"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`feedback-${s.studentId}`}>Feedback</Label>
                    <textarea
                      id={`feedback-${s.studentId}`}
                      name="feedback"
                      rows={3}
                      defaultValue={s.feedback ?? ""}
                      placeholder="Constructive feedback for the student…"
                      className="w-full rounded-xl border border-hairline/60 bg-card p-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    />
                  </div>

                  <div className="flex justify-end pt-2 border-t border-hairline/60">
                    <Button type="submit" size="sm">
                      Save mark
                    </Button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
