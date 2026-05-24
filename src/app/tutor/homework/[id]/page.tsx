import Link from "next/link";
import { Card, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { markSubmission } from "../../_actions";
import { getHomeworkDetail, requireTutor } from "../../_data";

const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  viewed: "Viewed",
  submitted: "Submitted",
  late: "Late",
  marked: "Marked",
  returned: "Returned",
  resubmission_requested: "Resubmit",
};

const STATUS_TONE: Record<string, string> = {
  not_started: "bg-muted/10 text-ink-soft border-hairline",
  viewed: "bg-sky-50 text-sky-800 border-sky-200",
  submitted: "bg-amber-50 text-amber-800 border-amber-200",
  late: "bg-rose-50 text-rose-800 border-rose-200",
  marked: "bg-emerald-50 text-emerald-800 border-emerald-200",
  returned: "bg-emerald-50 text-emerald-800 border-emerald-200",
  resubmission_requested: "bg-amber-50 text-amber-800 border-amber-200",
};

export default async function HomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tutor = await requireTutor();
  const { homework, submissions } = await getHomeworkDetail(tutor.id, id);

  return (
    <div className="space-y-12">
      <header className="rise space-y-3">
        <Link
          href="/tutor/homework"
          className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-ink"
        >
          ← All homework
        </Link>
        <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-ink">
          {homework.title}
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
          <span>Due {dateFmt.format(new Date(homework.dueDate))}</span>
          {homework.allowResubmission && <span>Resubmission allowed</span>}
          {homework.attachmentUrl && (
            <a
              href={homework.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 underline-offset-4 hover:underline"
            >
              View attachment ↗
            </a>
          )}
        </div>
        {homework.description && (
          <p className="text-sm text-ink-soft max-w-2xl whitespace-pre-wrap">
            {homework.description}
          </p>
        )}
      </header>

      <section className="rise space-y-4" style={{ animationDelay: "80ms" }}>
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted">
          Submissions · {submissions.length}
        </h2>

        {submissions.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-soft">
              No students assigned yet. Assign to a class to populate this list.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => (
              <Card key={s.studentId} className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <Link
                      href={`/tutor/students/${s.studentId}`}
                      className="text-lg text-ink hover:underline underline-offset-4"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    {s.yearLevel && (
                      <span className="ml-3 text-xs text-muted">
                        {s.yearLevel}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full border ${
                      STATUS_TONE[s.status] ?? STATUS_TONE.not_started
                    }`}
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                </div>

                {s.submittedAt && (
                  <div className="text-xs text-muted">
                    Submitted {dateFmt.format(s.submittedAt)}
                  </div>
                )}

                {(s.submissionUrl || s.submissionText) && (
                  <div className="rounded-xl border border-hairline/60 bg-brand-50/40 p-4 space-y-2">
                    <CardLabel>Submission</CardLabel>
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
                        className="text-sm text-brand-700 underline-offset-4 hover:underline"
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
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
