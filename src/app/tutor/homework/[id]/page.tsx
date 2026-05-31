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
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { HOMEWORK_BUCKET } from "@/app/student/homework/_storage";
import { markSubmission } from "../../_actions";
import { getHomeworkDetail, requireTutor } from "../../_data";

async function signSubmissionUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(HOMEWORK_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export default async function HomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tutor = await requireTutor();
  const { homework, submissions } = await getHomeworkDetail(tutor.id, id);

  const signedSubmissions = await Promise.all(
    submissions.map(async (s) => ({
      ...s,
      signedUrl: await signSubmissionUrl(s.submissionUrl),
    })),
  );

  const toMarkCount = signedSubmissions.filter(
    (s) => s.status === "submitted" || s.status === "late",
  ).length;
  const markedCount = signedSubmissions.filter(
    (s) => s.status === "marked" || s.status === "returned",
  ).length;

  return (
    <div className="space-y-6">
      <header className="rise space-y-2">
        <Link
          href="/tutor/homework"
          className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
        >
          ← All homework
        </Link>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
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
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3">
          <div className="text-xl font-medium text-ink">Submissions</div>
          <div className="flex items-center gap-2 text-sm">
            {toMarkCount > 0 && (
              <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide">
                {toMarkCount} to mark
              </span>
            )}
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide">
              {markedCount} marked
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-muted">
              {submissions.length} total
            </span>
          </div>
        </div>

        {signedSubmissions.length === 0 ? (
          <div className="px-6 py-8 text-sm text-ink-soft">
            No students assigned yet. Assign to a class to populate this list.
          </div>
        ) : (
          <div className="p-5 grid gap-4">
            {signedSubmissions.map((s) => {
              const hasSubmission = Boolean(
                s.submissionUrl || s.submissionText,
              );
              const isMarked =
                s.status === "marked" || s.status === "returned";
              const isLate = s.status === "late";
              const isSubmitted = s.status === "submitted";
              const isResubmit = s.status === "resubmission_requested";
              const isPending = !isMarked && !isLate && !isSubmitted && !isResubmit;
              return (
                <article
                  key={s.studentId}
                  className={cn(
                    "rounded-2xl border-2 p-5 space-y-4 transition-colors",
                    isMarked && "border-emerald-300 bg-emerald-50/50",
                    isSubmitted && "border-emerald-300 bg-emerald-50/40",
                    isLate && "border-amber-400 bg-amber-50/60",
                    isResubmit && "border-rose-300 bg-rose-50/40",
                    isPending && "border-brand-300 bg-brand-50/40",
                  )}
                >
                  {/* Student header */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-hairline/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 text-white",
                          isMarked && "bg-emerald-600",
                          isSubmitted && "bg-emerald-600",
                          isLate && "bg-amber-600",
                          isResubmit && "bg-rose-600",
                          isPending && "bg-brand-600",
                        )}
                      >
                        {s.firstName.charAt(0)}
                        {s.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/tutor/students/${s.studentId}`}
                          className="text-lg font-semibold text-ink hover:underline underline-offset-4 truncate block"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                        {s.yearLevel && (
                          <div className="text-xs text-muted">
                            {s.yearLevel}
                          </div>
                        )}
                      </div>
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

                  {/* Submission area */}
                  {hasSubmission ? (
                    <div className="rounded-xl border border-hairline/60 bg-white p-4 space-y-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-semibold">
                          Submission
                        </div>
                        {s.submittedAt && (
                          <div className="text-xs text-muted tabular-nums">
                            {relativeTime(s.submittedAt)}
                          </div>
                        )}
                      </div>
                      {s.submissionText && (
                        <p className="text-sm text-ink whitespace-pre-wrap border-l-2 border-brand-300 pl-3">
                          {s.submissionText}
                        </p>
                      )}
                      {s.signedUrl && (
                        <a
                          href={s.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 transition-colors"
                        >
                          Open file ↗
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-ink-soft italic">
                      No submission yet.
                    </div>
                  )}

                  {/* Marking form — compact horizontal layout */}
                  <form
                    action={markSubmission}
                    className="space-y-3 pt-2 border-t border-hairline/40"
                  >
                    <input type="hidden" name="homeworkId" value={homework.id} />
                    <input type="hidden" name="studentId" value={s.studentId} />

                    <div className="grid sm:grid-cols-[1fr_120px_auto] gap-3 items-end">
                      <div className="space-y-1">
                        <Label htmlFor={`status-${s.studentId}`}>Status</Label>
                        <select
                          id={`status-${s.studentId}`}
                          name="status"
                          defaultValue={s.status}
                          className="h-10 w-full rounded-lg border border-hairline/60 bg-card px-3 text-sm text-ink"
                        >
                          <option value="marked">Marked</option>
                          <option value="returned">Returned</option>
                          <option value="resubmission_requested">
                            Request resubmit
                          </option>
                          <option value="submitted">Submitted</option>
                          <option value="late">Late</option>
                          <option value="viewed">Viewed</option>
                          <option value="not_started">Not started</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`score-${s.studentId}`}>Score</Label>
                        <Input
                          id={`score-${s.studentId}`}
                          name="score"
                          type="number"
                          step="0.01"
                          defaultValue={s.score ?? ""}
                          placeholder="—"
                          className="h-10"
                        />
                      </div>
                      <Button type="submit" size="sm" className="h-10">
                        Save mark
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`feedback-${s.studentId}`}>
                        Feedback
                      </Label>
                      <textarea
                        id={`feedback-${s.studentId}`}
                        name="feedback"
                        rows={2}
                        defaultValue={s.feedback ?? ""}
                        placeholder="Constructive feedback for the student…"
                        className="w-full rounded-lg border border-hairline/60 bg-card p-3 text-sm text-ink placeholder:text-muted/70 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                      />
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
