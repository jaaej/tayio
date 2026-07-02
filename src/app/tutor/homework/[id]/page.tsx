import Link from "next/link";
import { Card, CardHead, CardBody } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Pill } from "@/components/student/pill";
import { Label } from "@/components/ui/input";
import { formatDueDate, relativeTime } from "@/lib/format";
import { HOMEWORK_STATUS_LABEL } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { HOMEWORK_BUCKET, signHomeworkAttachment } from "@/app/student/homework/_storage";
import { markSubmission } from "../../_actions";
import { getHomeworkDetail, requireTutor } from "../../_data";

const HW_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = {
  marked: "good",
  returned: "good",
  submitted: "good",
  late: "bad",
  resubmission_requested: "warn",
  viewed: "info",
  not_started: "neutral",
};

const INPUT_CLS =
  "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

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

  const attachmentHref = await signHomeworkAttachment(
    await createClient(),
    homework.attachmentUrl,
  );

  const toMarkCount = signedSubmissions.filter(
    (s) => s.status === "submitted" || s.status === "late",
  ).length;
  const markedCount = signedSubmissions.filter(
    (s) => s.status === "marked" || s.status === "returned",
  ).length;

  return (
    <div className="space-y-5">
      <Link
        href="/tutor/homework"
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-600 hover:text-brand-700"
      >
        ← All homework
      </Link>

      <PageHead
        eyebrow={`Due ${formatDueDate(new Date(homework.dueDate))}`}
        title={homework.title}
        sub={
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            {homework.allowResubmission && (
              <span className="text-muted">Resubmission allowed</span>
            )}
            {attachmentHref && (
              <a
                href={attachmentHref}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 font-bold hover:text-brand-700"
              >
                View attachment ↗
              </a>
            )}
          </div>
        }
      />

      {homework.description && (
        <Card>
          <CardBody>
            <p className="text-[13px] text-ink-soft whitespace-pre-wrap leading-snug">
              {homework.description}
            </p>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHead
          title="Submissions"
          action={
            <span className="flex items-center gap-2 text-[11px]">
              {toMarkCount > 0 && (
                <Pill tone="warn">{toMarkCount} to mark</Pill>
              )}
              <Pill tone="good">{markedCount} marked</Pill>
              <span className="text-muted">{submissions.length} total</span>
            </span>
          }
        />

        {signedSubmissions.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted text-center">
            No students assigned yet. Assign to a class to populate this list.
          </div>
        ) : (
          <div className="p-4 grid gap-3.5">
            {signedSubmissions.map((s) => {
              const hasSubmission = Boolean(
                s.submissionUrl || s.submissionText,
              );
              return (
                <article
                  key={s.studentId}
                  className="rounded-[14px] border border-line bg-surface p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-line">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-brand-500 text-white grid place-items-center text-[12px] font-bold shrink-0">
                        {s.firstName.charAt(0)}
                        {s.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/tutor/students/${s.studentId}`}
                          className="text-[14px] font-extrabold text-ink hover:text-brand-700 truncate block"
                        >
                          {s.firstName} {s.lastName}
                        </Link>
                        {s.yearLevel && (
                          <div className="text-[11px] text-muted">
                            {s.yearLevel}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.score !== null && (
                        <Pill tone="info">{s.score}</Pill>
                      )}
                      <Pill tone={HW_TONE[s.status] ?? "neutral"}>
                        {HOMEWORK_STATUS_LABEL[s.status] ?? s.status}
                      </Pill>
                    </div>
                  </div>

                  {hasSubmission ? (
                    <div className="rounded-[12px] border border-line bg-surface-2 p-3 space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted font-bold">
                          Submission
                        </div>
                        {s.submittedAt && (
                          <div className="text-[11px] text-muted tabular-nums">
                            {relativeTime(s.submittedAt)}
                          </div>
                        )}
                      </div>
                      {s.submissionText && (
                        <p className="text-[13px] text-ink whitespace-pre-wrap border-l-2 border-brand-300 pl-3 leading-snug">
                          {s.submissionText}
                        </p>
                      )}
                      {s.signedUrl && (
                        <a
                          href={s.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 text-white px-3.5 py-1.5 text-[12px] font-bold hover:bg-brand-700"
                        >
                          Open file ↗
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="text-[13px] text-muted italic">
                      No submission yet.
                    </div>
                  )}

                  <form
                    action={markSubmission}
                    className="space-y-2.5 pt-3 border-t border-line"
                  >
                    <input
                      type="hidden"
                      name="homeworkId"
                      value={homework.id}
                    />
                    <input
                      type="hidden"
                      name="studentId"
                      value={s.studentId}
                    />

                    <div className="grid sm:grid-cols-[1fr_120px_auto] gap-2.5 items-end">
                      <div className="space-y-1">
                        <Label htmlFor={`status-${s.studentId}`}>Status</Label>
                        <select
                          id={`status-${s.studentId}`}
                          name="status"
                          defaultValue={s.status}
                          className={INPUT_CLS}
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
                        <input
                          id={`score-${s.studentId}`}
                          name="score"
                          type="number"
                          step="0.01"
                          defaultValue={s.score ?? ""}
                          placeholder="—"
                          className={INPUT_CLS}
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-10 rounded-full bg-brand-600 text-white px-4 text-[12px] font-bold hover:bg-brand-700"
                      >
                        Save mark
                      </button>
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
                        className={`${INPUT_CLS} h-auto py-2`}
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
