import Link from "next/link";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { eq } from "drizzle-orm";
import {
  Avatar,
  Empty,
  Pill,
  SubjectDot,
  buttonVariants,
  type PillTone,
} from "@/components/admin/ui";
import { FileViewerButton } from "@/components/ui/file-viewer";
import { db } from "@/db/client";
import { classes, subjects } from "@/db/schema";
import { formatClockTime, formatScore } from "@/lib/format";
import { classDisplayName } from "@/lib/class-display";
import { HOMEWORK_STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/utils";
import { signHomeworkAttachment, signHomeworkSubmission } from "@/app/student/homework/_storage";
import { MarkupFileButton } from "@/components/markup/markup-file-button";
import { markupFileKind } from "@/lib/markup/doc";
import { getHomeworkDetail, requireTutor } from "../../_data";
import { getToMark } from "../_lib/marking-data";
import {
  listHref,
  nextToMark,
  parseMarkingView,
  submissionHref,
} from "../_lib/marking-list";
import { HomeworkSettings } from "./_components/homework-settings";
import { MarkForm } from "./_components/mark-form";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, PillTone> = {
  late: "bad",
  submitted: "info",
  marked: "good",
  returned: "good",
  resubmission_requested: "warn",
  viewed: "default",
  not_started: "default",
};

/** Format a Date as a local-time value for <input type="datetime-local">. */
function toDateTimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

const MELBOURNE = "Australia/Melbourne";
const dayFmt = new Intl.DateTimeFormat("en-AU", {
  timeZone: MELBOURNE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Sat 10 Oct" - en-AU puts a comma after the weekday; drop it. */
const shortDay = (d: Date) => dayFmt.format(d).replace(",", "");

function fileNameOf(path: string): string {
  const last = decodeURIComponent(path.split("?")[0].split("/").pop() ?? "");
  // Submissions are stored as "<timestamp>-<original name>" (older ones
  // "<uuid>-<original name>"); show the original name.
  return (
    last.replace(/^(?:\d{10,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[-_]/i, "") ||
    "Submission"
  );
}

/**
 * Right pane of the Marking split view. `[id]` is the homework (every older
 * link points here); `?student=` selects one submission to mark. Without it,
 * the pane shows the homework and everyone it was set for.
 */
export default async function HomeworkMarkingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ student?: string; view?: string; q?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tutor = await requireTutor();
  // Scoped to this tutor's homework; 404s otherwise.
  const { homework, submissions } = await getHomeworkDetail(tutor.id, id);
  const list = { view: parseMarkingView(sp.view), q: (sp.q ?? "").trim() };

  const [[cls], attachmentHref, solutionHref] = await Promise.all([
    homework.classId
      ? db
          .select({
            className: classes.name,
            subjectName: subjects.name,
            subjectColor: subjects.color,
          })
          .from(classes)
          .innerJoin(subjects, eq(subjects.id, classes.subjectId))
          .where(eq(classes.id, homework.classId))
          .limit(1)
      : Promise.resolve([]),
    signHomeworkAttachment(homework.attachmentUrl),
    signHomeworkAttachment(homework.solutionUrl),
  ]);
  const classLabel = cls ? classDisplayName(cls.subjectName, cls.className) : null;
  const dueLabel = `due ${shortDay(new Date(homework.dueDate))}`;

  const settings = (
    <HomeworkSettings
      form={{
        homeworkId: homework.id,
        title: homework.title,
        description: homework.description,
        dueDate: toDateTimeLocal(new Date(homework.dueDate)),
        allowResubmission: homework.allowResubmission,
        isTest: homework.isTest,
        hasAttachment: Boolean(homework.attachmentUrl),
        attachmentHref,
      }}
      hasSolution={Boolean(homework.solutionUrl)}
      solutionHref={solutionHref}
    />
  );
  const backHref = listHref("/tutor/homework", list);
  const selected = sp.student ? submissions.find((s) => s.studentId === sp.student) : undefined;

  if (!selected) {
    return (
      <section
        aria-labelledby="homework-heading"
        className="glass flex min-w-0 flex-col rounded-[24px] p-1.5"
      >
        <PaneHeader
          headingId="homework-heading"
          backHref={backHref}
          title={homework.title}
          sub={[classLabel, dueLabel].filter(Boolean).join(" · ")}
          subject={cls ? { name: cls.subjectName, color: cls.subjectColor } : null}
          actions={settings}
        />
        <div className="panel flex flex-col overflow-hidden">
          {(homework.description || attachmentHref) && (
            <div className="flex flex-col gap-3 border-b border-line p-4">
              {homework.description && (
                <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
                  {homework.description}
                </p>
              )}
              {attachmentHref && (
                <FileViewerButton
                  url={attachmentHref}
                  title={`${homework.title} attachment`}
                  className="self-start"
                >
                  View homework file
                </FileViewerButton>
              )}
            </div>
          )}
          {submissions.length === 0 ? (
            <Empty>No students have been assigned this homework.</Empty>
          ) : (
            <ul>
              {submissions.map((s) => {
                const name = `${s.firstName} ${s.lastName}`.trim();
                return (
                  <li key={s.studentId} className="border-b border-line last:border-b-0">
                    <Link
                      href={submissionHref(homework.id, s.studentId, list)}
                      className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                    >
                      <Avatar name={name} size={34} tone="brand" />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
                        {name}
                      </span>
                      {s.score !== null && (
                        <span className="text-[13px] font-extrabold tabular-nums text-ink">
                          {formatScore(s.score)}
                        </span>
                      )}
                      <Pill tone={STATUS_TONE[s.status] ?? "default"}>
                        {HOMEWORK_STATUS_LABEL[s.status] ?? s.status}
                      </Pill>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    );
  }

  const name = `${selected.firstName} ${selected.lastName}`.trim();
  const queue = await getToMark(tutor.id);
  const next = nextToMark(queue, { homeworkId: homework.id, studentId: selected.studentId });
  // getHomeworkDetail only returns this tutor's homework, so the server signs it.
  const signedUrl = await signHomeworkSubmission(selected.submissionUrl);
  const markable =
    selected.submissionUrl && !selected.submissionUrl.startsWith("http")
      ? markupFileKind(selected.submissionUrl)
      : null;
  const hasSubmission = Boolean(selected.submissionText || selected.submissionUrl);
  const sub = [
    homework.title,
    classLabel,
    dueLabel +
      (selected.submittedAt ? `, submitted ${shortDay(selected.submittedAt)} ${formatClockTime(selected.submittedAt)}` : ""),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-labelledby="submission-heading"
      className="glass flex min-w-0 flex-col rounded-[24px] p-1.5"
    >
      <PaneHeader
        headingId="submission-heading"
        backHref={backHref}
        title={name}
        status={selected.status}
        sub={sub}
        subject={cls ? { name: cls.subjectName, color: cls.subjectColor } : null}
        actions={
          <>
            {settings}
            <Link
              href={`/tutor/students/${selected.studentId}`}
              className={cn(buttonVariants({ variant: "glass" }), "h-[38px] rounded-[11px] px-3")}
            >
              <UserRound className="h-4 w-4" aria-hidden />
              Student
            </Link>
          </>
        }
      />
      <div className="panel flex min-h-[460px] flex-col overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <h3 className="text-[13px] font-extrabold text-muted">Submission</h3>
          {!hasSubmission && (
            <p className="text-[14px] text-muted">
              {selected.submittedAt ? "Submitted without text or a file." : "Nothing submitted yet."}
            </p>
          )}
          {selected.submissionText && (
            <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">
              {selected.submissionText}
            </p>
          )}
          {selected.submissionUrl && (
            <div className="flex items-center gap-3 rounded-[12px] bg-[#F8F9FC] px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-bad-bg text-[10px] font-extrabold uppercase text-bad">
                {(fileNameOf(selected.submissionUrl).split(".").pop() ?? "File").slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
                {fileNameOf(selected.submissionUrl)}
              </span>
              {markable ? (
                <MarkupFileButton
                  target={{ kind: "submission", homeworkId: homework.id, studentId: selected.studentId }}
                  title={`${name} submission`}
                  fileKind={markable === "pdf" ? "pdf" : "image"}
                  className="shrink-0 rounded-[10px]"
                >
                  View and mark
                </MarkupFileButton>
              ) : signedUrl ? (
                <FileViewerButton
                  url={signedUrl}
                  title={`${name} submission`}
                  className="shrink-0 rounded-[10px]"
                >
                  View file
                </FileViewerButton>
              ) : (
                <span className="text-[12px] text-muted">File unavailable</span>
              )}
            </div>
          )}
          <p className="flex items-center gap-2.5 text-[12px] text-muted">
            <span
              aria-hidden
              className={cn(
                "h-[7px] w-[7px] rounded-full",
                homework.solutionUrl ? "bg-[#16A34A]" : "bg-[#E8890C]",
              )}
            />
            {homework.solutionUrl
              ? "Solution uploaded · students see it after the due date"
              : "No solution uploaded"}
          </p>
        </div>
        <MarkForm
          key={`${homework.id}:${selected.studentId}`}
          homeworkId={homework.id}
          studentId={selected.studentId}
          studentFirstName={selected.firstName || name}
          status={selected.status}
          score={selected.score}
          feedback={selected.feedback}
          nextHref={next ? submissionHref(next.homeworkId, next.studentId, list) : null}
          doneHref={backHref}
        />
      </div>
    </section>
  );
}

function PaneHeader({
  headingId,
  backHref,
  title,
  status,
  sub,
  subject,
  actions,
}: {
  headingId: string;
  backHref: string;
  title: string;
  status?: string;
  sub: string;
  subject: { name: string; color: string | null } | null;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 pl-2 pr-2.5 sm:pl-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back to marking"
          title="Back to marking"
          className={cn(
            buttonVariants({ variant: "glass", size: "icon" }),
            "h-10 w-10 shrink-0 rounded-[12px] xl:hidden",
          )}
        >
          <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-[20px] font-extrabold leading-tight text-ink">
              {title}
            </h2>
            {status && (
              <Pill tone={STATUS_TONE[status] ?? "default"} className="uppercase">
                {HOMEWORK_STATUS_LABEL[status] ?? status}
              </Pill>
            )}
          </span>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
            {subject && <SubjectDot subject={subject.name} color={subject.color} />}
            <span>{sub}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
    </div>
  );
}
