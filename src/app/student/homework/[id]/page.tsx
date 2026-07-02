import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Button } from "@/components/student/button";
import { Card, CardBody, CardLabel } from "@/components/student/card";
import { PageHead } from "@/components/student/page-head";
import { Trophy } from "lucide-react";
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
import {
  getHomeworkDetail,
  getStudentTestRank,
} from "../../_lib/queries";
import { HOMEWORK_BUCKET, signHomeworkAttachment } from "../_storage";

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
  const attachmentHref = await signHomeworkAttachment(supabase, hw.attachmentUrl);

  // effectiveStatus is "not_started" → "viewed" by now, so omit it here.
  const canSubmit =
    effectiveStatus === "viewed" ||
    effectiveStatus === "resubmission_requested" ||
    (effectiveStatus === "submitted" && hw.allowResubmission) ||
    (effectiveStatus === "late" && hw.allowResubmission);

  const isOverdue = !hw.submittedAt && hw.dueDate < new Date();

  // Test rank — only fetched when this homework is flagged as a test and the
  // student has been marked. Anonymous: returns rank + total only.
  const testRank =
    hw.isTest && hw.score !== null
      ? await getStudentTestRank(user.id, id)
      : null;

  return (
    <div className="space-y-5">
      <Link
        href="/student/subjects"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-ink"
      >
        ← All homework
      </Link>

      {submitted && (
        <Card className="border-good/40 bg-good-bg">
          <CardBody>
            <div className="text-sm text-good font-semibold">
              Submission received. Your tutor will mark it soon.
            </div>
          </CardBody>
        </Card>
      )}
      {error && (
        <Card className="border-bad/40 bg-bad-bg">
          <CardBody>
            <div className="text-sm text-bad font-semibold">
              Couldn't upload: {decodeURIComponent(error)}
            </div>
          </CardBody>
        </Card>
      )}

      <PageHead
        eyebrow={hw.className ?? "Homework"}
        title={hw.title}
        sub={
          <div className="flex flex-wrap items-center gap-3">
            <span>Due {formatDueDate(hw.dueDate)}</span>
            {isOverdue && (
              <span className="text-warn text-[11px] uppercase tracking-wider font-bold">
                Overdue
              </span>
            )}
            <StatusBadge
              label={HOMEWORK_STATUS_LABEL[effectiveStatus] ?? effectiveStatus}
              className={HOMEWORK_STATUS_STYLE[effectiveStatus]}
            />
          </div>
        }
      />

      <Card className="space-y-7 p-5">

        {hw.description && (
          <section>
            <CardLabel>Instructions</CardLabel>
            <div className="mt-2 text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {hw.description}
            </div>
          </section>
        )}

        {attachmentHref && (
          <section>
            <CardLabel>Worksheet</CardLabel>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm text-ink-soft">
                Provided by your tutor.
              </div>
              <a
                href={attachmentHref}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand-700 hover:underline"
              >
                Download →
              </a>
            </div>
          </section>
        )}

        {(hw.feedback || hw.score) && (
          <section className="space-y-3">
            <CardLabel>Tutor feedback</CardLabel>
            {hw.score && (
              <div className="text-sm text-ink">
                Score: <span className="font-medium">{hw.score}</span>
              </div>
            )}
            {testRank && (
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5">
                <Trophy
                  className="h-4 w-4"
                  style={{ color: "var(--brand-600)" }}
                  aria-hidden
                />
                <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-700">
                  Test rank
                </span>
                <span className="text-[14px] font-bold text-brand-700 tabular-nums">
                  #{testRank.rank}{" "}
                  <span className="opacity-70 text-[12px]">
                    / {testRank.total}
                  </span>
                </span>
              </div>
            )}
            {hw.feedback && (
              <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {hw.feedback}
              </div>
            )}
          </section>
        )}

        <section className="space-y-5">
          <CardLabel>Your submission</CardLabel>
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
                  className="block w-full text-sm text-ink file:mr-4 file:rounded-lg file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-brand-ink hover:file:bg-brand-200"
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
                <Button type="submit" variant="primary">
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
        </section>
      </Card>
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
