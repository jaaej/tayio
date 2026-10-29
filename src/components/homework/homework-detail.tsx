import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Lock, PenLine, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/admin/ui";
import { MarkupFileButton } from "@/components/markup/markup-file-button";
import { FileViewerButton } from "@/components/ui/file-viewer";
import { formatClockTime, formatScore } from "@/lib/format";
import { isAwaitingMarking, isMarked } from "@/lib/homework-rules";
import { markupFileKind } from "@/lib/markup/doc";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";
import {
  daysUntil,
  formatHomeworkDate,
  submissionFileName,
} from "@/app/student/homework/_lib/homework-list";

/*
 * One homework, as the student sees it on /student/homework/[id] and as a
 * parent sees their child's on /parent/homework/[id]: the header with the
 * due date and status, the instructions and files, the tutor's mark and
 * feedback, and the submission. The student page adds the submit form; the
 * parent page is read only. An admin reads the feedback and submission on a
 * student's History tab. `viewer` picks the wording ("Your submission" or
 * "Sarah's submission").
 */

export type HomeworkViewer =
  | { kind: "student" }
  | { kind: "parent"; childFirstName: string }
  | { kind: "admin"; studentFirstName: string };

/** Whose work a parent or an admin is reading: "Sarah". */
function ownerName(viewer: Exclude<HomeworkViewer, { kind: "student" }>): string {
  return viewer.kind === "parent" ? viewer.childFirstName : viewer.studentFirstName;
}

/**
 * The line under someone else's submission while there is no mark yet:
 * waiting for marking, sent back, or not handed in. Null once marked.
 */
export function submissionNote(status: string, firstName: string): string | null {
  if (isMarked(status)) return null;
  if (isAwaitingMarking(status)) return "Waiting for the tutor to mark this.";
  if (status === "resubmission_requested") return `The tutor asked ${firstName} to resubmit this.`;
  return `${firstName} hasn't handed this in yet.`;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  viewed: "Not started",
  resubmission_requested: "Resubmission requested",
  submitted: "Submitted",
  late: "Submitted late",
  // A family hears that the tutor has responded; tutors and admins keep "Marked".
  marked: "Feedback given",
  // Retired choice that meant the same as Marked.
  returned: "Feedback given",
};

/** Where a homework stands, in a family's words ("Submitted late"). */
export function homeworkStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

const LINE_BTN =
  "h-[34px] min-h-0 shrink-0 rounded-[10px] border border-[#DFE1EC] bg-white px-3 text-[12px] font-bold text-ink hover:bg-[#F5F6FA]";

/** "in 3 days", "today", "tomorrow" or "overdue" beside the due date. */
function relativeDue(due: Date, now: Date): string {
  const days = daysUntil(due, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/**
 * "pdf" or "image" when a stored file opens in the writing viewer (a PDF,
 * PNG or JPEG in portal storage), else null for the plain viewer.
 */
function writable(path: string | null): "pdf" | "image" | null {
  if (!path || path.startsWith("http")) return null;
  const kind = markupFileKind(path);
  return kind === "pdf" ? "pdf" : kind ? "image" : null;
}

/** File type badge text from a stored path ("PDF", "DOCX"), or "FILE". */
function fileKind(path: string | null): string {
  const ext = path?.split("?")[0].split(".").pop() ?? "";
  return /^[a-z0-9]{2,4}$/i.test(ext) ? ext.toUpperCase() : "FILE";
}

export type HomeworkDetailData = {
  homeworkId: string;
  title: string;
  description: string | null;
  dueDate: Date;
  isTest: boolean;
  submittedAt: Date | null;
  submissionUrl: string | null;
  submissionText: string | null;
  score: string | null;
  feedback: string | null;
  attachmentUrl: string | null;
  solutionUrl: string | null;
  className: string | null;
  subjectName: string | null;
  subjectColor: string | null;
};

/** What the feedback and submission sections read: the hand-in and the mark. */
export type HomeworkWork = Pick<
  HomeworkDetailData,
  "homeworkId" | "title" | "submittedAt" | "submissionUrl" | "submissionText" | "score" | "feedback"
>;

/** The glass frame: back button, class, title, due date and status chips. */
export function HomeworkDetailFrame({
  hw,
  status,
  classLabel,
  backHref,
  backLabel,
  now,
  children,
}: {
  hw: HomeworkDetailData;
  status: string;
  classLabel: string;
  backHref: string;
  backLabel: string;
  now: Date;
  children: ReactNode;
}) {
  const marked = isMarked(status);
  const open = !hw.submittedAt && !marked;
  const overdue = open && daysUntil(hw.dueDate, now) < 0;
  return (
    <section aria-labelledby="homework-heading" className="glass flex min-w-0 flex-col rounded-[24px] p-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 pl-3.5 pr-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            aria-label={backLabel}
            title={backLabel}
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
                style={{ backgroundColor: subjectTone(hw.subjectName ?? "", hw.subjectColor).dot }}
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
            {open && ` · ${relativeDue(hw.dueDate, now)}`}
          </span>
          <span className="flex h-7 items-center rounded-[14px] bg-white px-2.5 text-[12px] font-extrabold text-ink-soft">
            {homeworkStatusLabel(status)}
          </span>
        </div>
      </div>

      <div className="panel flex flex-1 flex-col overflow-hidden">{children}</div>
    </section>
  );
}

/** Instructions, the worksheet, and the solution once the due date has passed. */
export function HomeworkInstructions({
  hw,
  viewer,
  attachmentHref,
  solutionHref,
  solutionLocked,
}: {
  hw: HomeworkDetailData;
  viewer: HomeworkViewer;
  attachmentHref: string | null;
  solutionHref: string | null;
  solutionLocked: boolean;
}) {
  const tutor = viewer.kind === "student" ? "your tutor" : "the tutor";
  // A student writes on the worksheet and solution (and can hand the
  // worksheet in from there); a parent only looks.
  const worksheetKind = viewer.kind === "student" ? writable(hw.attachmentUrl) : null;
  const solutionKind = viewer.kind === "student" ? writable(hw.solutionUrl) : null;
  return (
    <div className="flex flex-col gap-3 border-b border-[#EFF0F5] p-4">
      <h3 className="text-[13px] font-extrabold text-muted">Instructions</h3>
      <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
        {hw.description || "No written instructions for this homework."}
      </p>
      {(attachmentHref || solutionHref || solutionLocked) && (
        <div className="flex flex-wrap gap-2">
          {attachmentHref && (
            <FileTile kind={fileKind(hw.attachmentUrl)} title="Worksheet" detail={`Worksheet from ${tutor}`}>
              {worksheetKind ? (
                <MarkupFileButton
                  target={{ kind: "homework-sheet", homeworkId: hw.homeworkId, sheet: "worksheet" }}
                  title={`${hw.title} worksheet`}
                  fileKind={worksheetKind}
                  resubmit={Boolean(hw.submittedAt)}
                  submittedHref={`/student/homework/${hw.homeworkId}?submitted=1`}
                  className={LINE_BTN}
                >
                  View file
                </MarkupFileButton>
              ) : (
                <FileViewerButton url={attachmentHref} title={`${hw.title} worksheet`} className={LINE_BTN}>
                  View file
                </FileViewerButton>
              )}
            </FileTile>
          )}
          {solutionHref && (
            <FileTile kind={fileKind(hw.solutionUrl)} title="Solution" detail="Check your answers">
              {solutionKind ? (
                <MarkupFileButton
                  target={{ kind: "homework-sheet", homeworkId: hw.homeworkId, sheet: "solution" }}
                  title={`${hw.title} solution`}
                  fileKind={solutionKind}
                  className={LINE_BTN}
                >
                  View file
                </MarkupFileButton>
              ) : (
                <FileViewerButton url={solutionHref} title={`${hw.title} solution`} className={LINE_BTN}>
                  View file
                </FileViewerButton>
              )}
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
  );
}

/**
 * The tutor's score, the anonymous test rank, the written feedback, and a
 * way into the marks the tutor wrote on the submitted file.
 */
export function HomeworkFeedback({
  hw,
  viewer,
  studentId,
  testRank,
  fileFeedback,
}: {
  hw: HomeworkWork;
  viewer: HomeworkViewer;
  /** Whose work this is: the student, or the parent's child. */
  studentId: string;
  testRank: { rank: number; total: number } | null;
  /** The tutor wrote on the submitted file and the family may see it. */
  fileFeedback: boolean;
}) {
  const marksKind = fileFeedback ? writable(hw.submissionUrl) : null;
  if (!hw.feedback && hw.score === null && !testRank && !marksKind) return null;
  const whose = viewer.kind === "student" ? "your" : `${ownerName(viewer)}'s`;
  return (
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
      {marksKind && (
        <div className="flex flex-wrap gap-2">
          <div className="flex min-w-0 flex-[1_1_240px] items-center gap-3 rounded-[12px] bg-[#F8F9FC] px-3 py-2.5">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-good-bg text-good"
            >
              <PenLine className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-bold text-ink">
              {viewer.kind === "student" ? "Your tutor" : "The tutor"} wrote on {whose} work
            </span>
            <MarkupFileButton
              target={{ kind: "submission", homeworkId: hw.homeworkId, studentId }}
              title={`${hw.title} - ${whose} submission`}
              fileKind={marksKind}
              className={LINE_BTN}
            >
              View marks
            </MarkupFileButton>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The submission: when it came in, the uploaded file and the written answer.
 * A PDF or picture opens with the tutor's marking on it once it is marked.
 * `note` is shown when nothing more can be handed in ("Waiting for ... to
 * mark this.").
 */
export function HomeworkSubmission({
  hw,
  viewer,
  studentId,
  submissionHref,
  note,
  divider = false,
}: {
  hw: HomeworkWork;
  viewer: HomeworkViewer;
  /** Whose work this is: the student, or the parent's child. */
  studentId: string;
  submissionHref: string | null;
  note?: string | null;
  /** Rule under the section, when the submit form follows it. */
  divider?: boolean;
}) {
  if (!hw.submittedAt && !hw.submissionText && !hw.submissionUrl && !note) return null;
  const whose = viewer.kind === "student" ? "Your" : `${ownerName(viewer)}'s`;
  const whoseInTitle = viewer.kind === "student" ? "your" : whose;
  const submissionKind = writable(hw.submissionUrl);
  return (
    <div className={cn("flex flex-col gap-3 p-4", divider && "border-b border-[#EFF0F5]")}>
      <h3 className="text-[13px] font-extrabold text-muted">{whose} submission</h3>
      {hw.submittedAt && (
        <p className="text-[13px] text-ink-soft">
          Submitted {formatHomeworkDate(hw.submittedAt)}, {formatClockTime(hw.submittedAt)}
        </p>
      )}
      {hw.submissionUrl && (
        // A row like the worksheet tiles: alone in this column, the tile's
        // flex basis would become its height.
        <div className="flex flex-wrap gap-2">
        <FileTile
          kind={fileKind(hw.submissionUrl)}
          title={submissionFileName(hw.submissionUrl)}
          detail={`${whose} upload`}
        >
          {submissionKind ? (
            <MarkupFileButton
              target={{ kind: "submission", homeworkId: hw.homeworkId, studentId }}
              title={`${hw.title} - ${whoseInTitle} submission`}
              fileKind={submissionKind}
              className={LINE_BTN}
            >
              View file
            </MarkupFileButton>
          ) : submissionHref ? (
            <FileViewerButton
              url={submissionHref}
              title={`${hw.title} - ${whoseInTitle} submission`}
              className={LINE_BTN}
            >
              View file
            </FileViewerButton>
          ) : (
            <span className="shrink-0 text-[12px] text-muted">File unavailable</span>
          )}
        </FileTile>
        </div>
      )}
      {hw.submissionText && (
        <p className="whitespace-pre-wrap rounded-[12px] bg-[#F8F9FC] px-4 py-3 text-[14px] leading-[1.6] text-ink">
          {hw.submissionText}
        </p>
      )}
      {note && (
        <p className="rounded-[12px] bg-[#F8F9FC] px-4 py-3 text-[13px] text-ink-soft">{note}</p>
      )}
    </div>
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
  children?: ReactNode;
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
