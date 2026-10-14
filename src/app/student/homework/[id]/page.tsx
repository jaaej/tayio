import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronLeft, Lock, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/admin/ui";
import { FileViewerButton } from "@/components/ui/file-viewer";
import { requireRole } from "@/lib/auth";
import { classDisplayName } from "@/lib/class-display";
import { formatClockTime, formatScore } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import { loadHomeworkDetail } from "../_lib/homework-detail";
import { boardHref, parseBoardParams } from "../_lib/homework-board";
import { daysUntil, formatHomeworkDate, submissionFileName } from "../_lib/homework-list";
import { SubmissionForm } from "./_components/submission-form";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  viewed: "Not started",
  resubmission_requested: "Resubmission requested",
  submitted: "Submitted",
  late: "Submitted late",
  marked: "Marked",
  returned: "Returned",
};

const LINE_BTN =
  "h-[34px] min-h-0 shrink-0 rounded-[10px] border border-[#DFE1EC] bg-white px-3 text-[12px] font-bold text-ink hover:bg-[#F5F6FA]";

/** "in 3 days", "today", "tomorrow" or "overdue" beside the due date. */
function relativeDue(due: Date): string {
  const now = new Date();
  if (due.getTime() < now.getTime()) return "overdue";
  const days = daysUntil(due, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** File type badge text from a stored path ("PDF", "DOCX"), or "FILE". */
function fileKind(path: string | null): string {
  const ext = path?.split("?")[0].split(".").pop() ?? "";
  return /^[a-z0-9]{2,4}$/i.test(ext) ? ext.toUpperCase() : "FILE";
}

/**
 * One homework, opened from the Homework page: instructions, worksheet and
 * solution, the student's work with Submit or Resubmit, and the tutor's
 * feedback and score once marked.
 */
export default async function HomeworkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string; subject?: string; show?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireRole("student");
  const detail = await loadHomeworkDetail(user.id, id);
  if (!detail) notFound();

  const { hw, status, canSubmit, submissionHref, attachmentHref, solutionHref, solutionLocked, testRank } =
    detail;
  const backHref = boardHref("/student/homework", parseBoardParams(sp));
  const classLabel = hw.subjectName || hw.className ? classDisplayName(hw.subjectName, hw.className) : "Independent task";
  const marked = status === "marked" || status === "returned";
  const open = !hw.submittedAt && !marked;
  const overdue = open && hw.dueDate.getTime() < Date.now();
  const hasFeedback = Boolean(hw.feedback || hw.score !== null || testRank);

  return (
    <section aria-labelledby="homework-heading" className="glass flex min-w-0 flex-col rounded-[24px] p-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 pl-3.5 pr-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label="Back to homework"
            title="Back to homework"
            className={cn(
              buttonVariants({ variant: "glass", size: "icon" }),
              "h-10 w-10 shrink-0 rounded-[12px]",
            )}
          >
            <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </Link>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink-soft">
              <span
                aria-hidden
                className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
                style={{ backgroundColor: subjectTone(hw.subjectName ?? "").dot }}
              />
              {classLabel}
              {hw.isTest && " · Test"}
            </span>
            <h1 id="homework-heading" className="text-[20px] font-extrabold leading-tight text-ink">
              {hw.title}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn(
              "flex h-7 items-center rounded-[14px] px-2.5 text-[12px] font-extrabold",
              !open ? "bg-white text-ink-soft" : overdue ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn",
            )}
          >
            Due {formatHomeworkDate(hw.dueDate)}
            {open && ` · ${relativeDue(hw.dueDate)}`}
          </span>
          <span className="flex h-7 items-center rounded-[14px] bg-white px-2.5 text-[12px] font-extrabold text-ink-soft">
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </div>

      <div className="panel flex flex-1 flex-col overflow-hidden">
        {sp.submitted && (
          <p
            role="status"
            className="flex items-center gap-2.5 border-b border-[#EFF0F5] bg-good-bg px-4 py-3 text-[13px] font-semibold text-good"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Submission received. Your tutor will mark it soon.
          </p>
        )}
        {sp.error && (
          <p
            role="alert"
            className="flex items-center gap-2.5 border-b border-[#EFF0F5] bg-bad-bg px-4 py-3 text-[13px] font-semibold text-bad"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {`Couldn't submit: ${safeDecode(sp.error)}`}
          </p>
        )}

        <div className="flex flex-col gap-3 border-b border-[#EFF0F5] p-4">
          <h3 className="text-[13px] font-extrabold text-muted">Instructions</h3>
          <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
            {hw.description || "No written instructions for this homework."}
          </p>
          {(attachmentHref || solutionHref || solutionLocked) && (
            <div className="flex flex-wrap gap-2">
              {attachmentHref && (
                <FileTile kind={fileKind(hw.attachmentUrl)} title="Worksheet" detail="Worksheet from your tutor">
                  <FileViewerButton url={attachmentHref} title={`${hw.title} worksheet`} className={LINE_BTN}>
                    View file
                  </FileViewerButton>
                </FileTile>
              )}
              {solutionHref && (
                <FileTile kind={fileKind(hw.solutionUrl)} title="Solution" detail="Check your answers">
                  <FileViewerButton url={solutionHref} title={`${hw.title} solution`} className={LINE_BTN}>
                    View file
                  </FileViewerButton>
                </FileTile>
              )}
              {solutionLocked && (
                <div className="flex flex-[1_1_240px] items-center gap-3 rounded-[12px] bg-[#F8F9FC] px-3 py-2.5 opacity-70">
                  <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#EEEFF6] text-muted"
                  >
                    <Lock className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[14px] font-bold text-ink">Solution</span>
                    <span className="text-[12px] text-muted">Opens after the due date</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasFeedback && (
          <div className="flex flex-col gap-3 border-b border-[#EFF0F5] p-4">
            <h3 className="text-[13px] font-extrabold text-muted">Feedback</h3>
            {(hw.score !== null || testRank) && (
              <div className="flex flex-wrap gap-1.5">
                {hw.score !== null && (
                  <span className="flex h-7 items-center rounded-[14px] bg-good-bg px-2.5 text-[12px] font-extrabold tabular-nums text-good">
                    Score {formatScore(hw.score)}
                  </span>
                )}
                {testRank && (
                  <span className="flex h-7 items-center gap-1.5 rounded-[14px] bg-[#EEEBFD] px-2.5 text-[12px] font-extrabold tabular-nums text-[#3A1AA8]">
                    <Trophy className="h-3.5 w-3.5" aria-hidden />
                    Test rank #{testRank.rank} of {testRank.total}
                  </span>
                )}
              </div>
            )}
            {hw.feedback && (
              <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">{hw.feedback}</p>
            )}
          </div>
        )}

        {(hw.submittedAt || hw.submissionText || hw.submissionUrl || (!canSubmit && !marked)) && (
          <div className={cn("flex flex-col gap-3 p-4", canSubmit && "border-b border-[#EFF0F5]")}>
            <h3 className="text-[13px] font-extrabold text-muted">Your submission</h3>
            {hw.submittedAt && (
              <p className="text-[13px] text-ink-soft">
                Submitted {formatHomeworkDate(hw.submittedAt)}, {formatClockTime(hw.submittedAt)}
              </p>
            )}
            {hw.submissionUrl && (
              <FileTile kind={fileKind(hw.submissionUrl)} title={submissionFileName(hw.submissionUrl)} detail="Your upload">
                {submissionHref ? (
                  <FileViewerButton url={submissionHref} title={`${hw.title} - your submission`} className={LINE_BTN}>
                    View file
                  </FileViewerButton>
                ) : (
                  <span className="shrink-0 text-[12px] text-muted">File unavailable</span>
                )}
              </FileTile>
            )}
            {hw.submissionText && (
              <p className="whitespace-pre-wrap rounded-[12px] bg-[#F8F9FC] px-4 py-3 text-[14px] leading-[1.6] text-ink">
                {hw.submissionText}
              </p>
            )}
            {!canSubmit && !marked && (
              <p className="rounded-[12px] bg-[#F8F9FC] px-4 py-3 text-[13px] text-ink-soft">
                {hw.submittedAt
                  ? "Waiting for your tutor to mark this."
                  : "Submissions are closed for this homework."}
              </p>
            )}
          </div>
        )}

        {canSubmit && <SubmissionForm homeworkId={hw.homeworkId} resubmit={Boolean(hw.submittedAt)} />}
      </div>
    </section>
  );
}

function FileTile({
  kind,
  title,
  detail,
  children,
}: {
  kind: string;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-[1_1_240px] items-center gap-3 rounded-[12px] bg-[#F8F9FC] px-3 py-2.5">
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[#FDE8E8] text-[10px] font-extrabold text-[#B42318]"
      >
        {kind}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-bold text-ink">{title}</span>
        <span className="text-[12px] text-muted">{detail}</span>
      </span>
      {children}
    </div>
  );
}

/** The submit route encodes its message once; tolerate a malformed value. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
