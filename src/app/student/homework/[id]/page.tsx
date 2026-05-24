import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { db } from "@/db/client";
import { homeworkAssignments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "../../_components/badge";
import {
  formatDueDate,
  HOMEWORK_STATUS_LABEL,
  HOMEWORK_STATUS_STYLE,
} from "../../_lib/format";
import { getHomeworkDetail } from "../../_lib/queries";
import { HOMEWORK_BUCKET } from "../_storage";

export default async function HomeworkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { id } = await params;
  const { submitted, error } = await searchParams;
  const user = await requireRole("student");
  const hw = await getHomeworkDetail(user.id, id);
  if (!hw) notFound();

  // Mark as viewed on first open.
  let effectiveStatus = hw.status;
  if (effectiveStatus === "not_started") {
    await db
      .update(homeworkAssignments)
      .set({ status: "viewed" })
      .where(
        and(
          eq(homeworkAssignments.homeworkId, id),
          eq(homeworkAssignments.studentId, user.id),
        ),
      );
    effectiveStatus = "viewed";
  }

  const supabase = await createClient();
  const submissionLink = await signedSubmissionLink(supabase, hw.submissionUrl);
  const attachmentHref = hw.attachmentUrl
    ? hw.attachmentUrl.startsWith("http")
      ? hw.attachmentUrl
      : (await supabase.storage
          .from(HOMEWORK_BUCKET)
          .createSignedUrl(hw.attachmentUrl, 3600)).data?.signedUrl ?? null
    : null;

  // effectiveStatus is "not_started" → "viewed" by now, so omit it here.
  const canSubmit =
    effectiveStatus === "viewed" ||
    effectiveStatus === "resubmission_requested" ||
    (effectiveStatus === "submitted" && hw.allowResubmission) ||
    (effectiveStatus === "late" && hw.allowResubmission);

  const isOverdue = !hw.submittedAt && hw.dueDate < new Date();

  return (
    <div className="space-y-10">
      <div className="rise">
        <Link
          href="/student/homework"
          className="text-xs text-brand-700 hover:underline"
        >
          ← All homework
        </Link>
      </div>

      <header className="rise" style={{ animationDelay: "60ms" }}>
        <CardLabel>{hw.className ?? "Homework"}</CardLabel>
        <h1 className="mt-2 text-3xl lg:text-4xl font-light tracking-tight text-ink">
          {hw.title}
        </h1>
        <div className="mt-4 flex items-center gap-3 text-sm text-ink-soft">
          <span>Due {formatDueDate(hw.dueDate)}</span>
          {isOverdue && (
            <span className="text-amber-800 text-xs uppercase tracking-wider">
              Overdue
            </span>
          )}
          <StatusBadge
            label={HOMEWORK_STATUS_LABEL[effectiveStatus] ?? effectiveStatus}
            className={HOMEWORK_STATUS_STYLE[effectiveStatus]}
          />
        </div>
      </header>

      {submitted && (
        <Card className="border-emerald-200 bg-emerald-50">
          <div className="text-sm text-emerald-900">
            Submission received. Your tutor will mark it soon.
          </div>
        </Card>
      )}
      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <div className="text-sm text-rose-900">
            Couldn't upload: {decodeURIComponent(error)}
          </div>
        </Card>
      )}

      {hw.description && (
        <section className="rise" style={{ animationDelay: "120ms" }}>
          <CardLabel>Instructions</CardLabel>
          <Card className="mt-3">
            <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {hw.description}
            </div>
          </Card>
        </section>
      )}

      {attachmentHref && (
        <section className="rise" style={{ animationDelay: "160ms" }}>
          <CardLabel>Worksheet</CardLabel>
          <Card className="mt-3 flex items-center justify-between">
            <div className="text-sm text-ink-soft">Provided by your tutor.</div>
            <a
              href={attachmentHref}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-brand-700 hover:underline"
            >
              Download →
            </a>
          </Card>
        </section>
      )}

      {(hw.feedback || hw.score) && (
        <section className="rise" style={{ animationDelay: "200ms" }}>
          <CardLabel>Tutor feedback</CardLabel>
          <Card className="mt-3 space-y-3">
            {hw.score && (
              <div className="text-sm text-ink">
                Score: <span className="font-medium">{hw.score}</span>
              </div>
            )}
            {hw.feedback && (
              <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {hw.feedback}
              </div>
            )}
          </Card>
        </section>
      )}

      <section className="rise" style={{ animationDelay: "240ms" }}>
        <CardLabel>Your submission</CardLabel>
        <Card className="mt-3 space-y-5">
          {hw.submittedAt && (
            <div className="text-sm text-ink-soft">
              Submitted {hw.submittedAt.toLocaleString("en-AU")}.{" "}
              {submissionLink && (
                <a
                  href={submissionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700 hover:underline"
                >
                  View file →
                </a>
              )}
            </div>
          )}

          {hw.submissionText && (
            <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed border-l-2 border-hairline pl-4">
              {hw.submissionText}
            </div>
          )}

          {canSubmit ? (
            <form
              action={`/api/student/homework/${id}/submit`}
              method="post"
              encType="multipart/form-data"
              className="space-y-4"
            >
              <div className="space-y-2">
                <label
                  htmlFor="submission-file"
                  className="block text-xs uppercase tracking-[0.16em] text-muted"
                >
                  Upload your work
                </label>
                <input
                  id="submission-file"
                  name="file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.heic"
                  className="block w-full text-sm text-ink file:mr-4 file:rounded-lg file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-navy-800 hover:file:bg-brand-200"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="submission-text"
                  className="block text-xs uppercase tracking-[0.16em] text-muted"
                >
                  Or type your answer
                </label>
                <textarea
                  id="submission-text"
                  name="text"
                  rows={5}
                  className="w-full rounded-xl border border-hairline/70 bg-card px-4 py-3 text-sm text-ink focus:border-brand-600 focus:outline-none"
                  placeholder="Write your answer here…"
                />
              </div>
              <div className="pt-2">
                <Button type="submit" variant="brand">
                  {hw.submittedAt ? "Resubmit" : "Submit"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-sm text-ink-soft">
              {effectiveStatus === "marked" || effectiveStatus === "returned"
                ? "This homework has been marked — no further submissions needed."
                : "Submissions are closed for this homework."}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

async function signedSubmissionLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage
    .from(HOMEWORK_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
