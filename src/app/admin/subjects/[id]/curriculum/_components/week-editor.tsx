"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill, type PillTone } from "@/components/admin/ui";
import {
  MATERIAL_BUTTON,
  MATERIAL_BUTTON_QUIET,
  MaterialCard,
} from "@/components/subjects/material-card";
import { WeekOverview } from "@/components/subjects/week-overview";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { HomeworkCreatePanel } from "@/components/homework/homework-create-panel";
import { HomeworkSolutionEditor } from "@/components/homework/homework-solution-editor";
import { FileViewerButton } from "@/components/ui/file-viewer";
import { uploadAdminVideo, uploadAdminBooklet } from "@/app/admin/_lib/actions-curriculum";
import type { SubjectWeek } from "@/db/schema";
import type { QuizTargetWeek } from "@/lib/quiz-queries";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { NewQuizPanel } from "@/app/admin/quizzes/_components/new-quiz-panel";
import { ApproveQuizButton } from "@/app/admin/quizzes/_components/approve-quiz-button";
import { formatDueDate } from "@/lib/format";
import { subjectTone } from "@/lib/subject-tone";
import { cn } from "@/lib/utils";

/**
 * One curriculum week as admin sees it, laid out like the student's week:
 * the Overview in the deep subject colour, Lesson & materials (with upload),
 * then Homework beside the Weekly quiz. The week's own fields are edited
 * from the hero's Edit week button.
 */
export function WeekEditor({
  week,
  subjectName,
  subjectColor,
  quiz,
  quizTutors,
  quizTarget,
  bookletSignedUrl,
  videoSignedUrl,
  homeworkClasses,
  homework,
}: {
  week: SubjectWeek;
  subjectName: string;
  /** The subject's stored colour (`subjects.color`). */
  subjectColor: string | null;
  quiz: {
    id: string;
    title: string;
    status: string;
    questionCount: number;
  } | null;
  quizTutors: { id: string; name: string }[];
  quizTarget: QuizTargetWeek;
  bookletSignedUrl: string | null;
  videoSignedUrl: string | null;
  homeworkClasses: Array<{ id: string; label: string }>;
  homework: Array<{
    id: string;
    title: string;
    dueDate: Date;
    attachmentUrl: string | null;
    attachmentHref: string | null;
    solutionUrl: string | null;
    solutionHref: string | null;
    classId: string | null;
    className: string | null;
  }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const accent = subjectTone(subjectName, subjectColor).flat;

  function handleUpload(kind: "video" | "booklet", file: File) {
    const formData = new FormData();
    formData.set("file", file);
    setError(null);
    startTransition(async () => {
      const result =
        kind === "video"
          ? await uploadAdminVideo(week.id, formData)
          : await uploadAdminBooklet(week.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <WeekOverview
        subjectName={subjectName}
        subjectColor={subjectColor}
        description={week.description}
        objectives={week.objectives}
        emptyText="No overview yet."
      />

      <section
        aria-labelledby="lm-h"
        className="glass flex flex-col gap-1.5 rounded-[24px] p-1.5"
      >
        <h2 id="lm-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold text-ink">
          Lesson &amp; materials
        </h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <FileSlot
            kind="video"
            label="Recorded lesson"
            currentPath={week.videoUrl}
            accept="video/*"
            pending={pending}
            accent={accent}
            onPick={(file) => handleUpload("video", file)}
            videoViewerUrl={videoSignedUrl}
          />
          <FileSlot
            kind="booklet"
            label="Week booklet"
            currentPath={week.bookletUrl}
            accept="application/pdf"
            pending={pending}
            accent={accent}
            onPick={(file) => handleUpload("booklet", file)}
            viewerUrl={bookletSignedUrl}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-[12px] bg-bad-bg px-3 py-2 text-[13px] font-semibold text-bad"
          >
            {error}
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section
          aria-labelledby="hw-h"
          className="glass flex min-w-0 flex-col gap-1.5 rounded-[24px] p-1.5"
        >
          <h2 id="hw-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold text-ink">
            Homework
          </h2>
          <div className="panel overflow-hidden">
            <div className="border-b border-[#EFF0F5] px-4 py-3">
              <HomeworkCreatePanel
                actor="admin"
                weekId={week.id}
                classes={homeworkClasses}
              />
            </div>
            {homework.length === 0 ? (
              <p className="px-4 py-6 text-center text-[14px] text-[#5E5A73]">
                No homework this week.
              </p>
            ) : (
              <ul className="m-0 list-none divide-y divide-[#EFF0F5] p-0">
                {homework.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h3 className="m-0 truncate text-[15px] font-extrabold text-ink">
                          {item.title}
                        </h3>
                        <span className="truncate text-[13px] font-medium text-[#5E5A73]">
                          {item.className ?? "Subject only"} · Due{" "}
                          {formatDueDate(item.dueDate)}
                        </span>
                      </span>
                      {item.attachmentHref && (
                        <FileViewerButton
                          url={item.attachmentHref}
                          title={`${item.title} attachment`}
                          className={VIEWER_PILL}
                        >
                          View
                        </FileViewerButton>
                      )}
                    </div>
                    <HomeworkSolutionEditor
                      homeworkId={item.id}
                      hasSolution={Boolean(item.solutionUrl)}
                      solutionHref={item.solutionHref}
                      compact
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-labelledby="qz-h"
          className="glass flex min-w-0 flex-col gap-1.5 self-start rounded-[24px] p-1.5"
        >
          <h2 id="qz-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold text-ink">
            Weekly quiz
          </h2>
          {quiz ? (
            <div className="panel flex flex-col gap-3 px-4 py-3.5">
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[15px] font-extrabold text-ink [overflow-wrap:anywhere]">
                  {quiz.title}
                </span>
                <span className="text-[13px] font-medium text-[#5E5A73]">
                  {quiz.questionCount} answerable question
                  {quiz.questionCount === 1 ? "" : "s"}
                </span>
              </span>
              <Pill
                tone={(QUIZ_STATUS_TONE[quiz.status] ?? "default") as PillTone}
                className="self-start"
              >
                {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
              </Pill>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/quizzes/${quiz.id}`}
                  className={cn(MATERIAL_BUTTON, MATERIAL_BUTTON_QUIET, "flex-1")}
                >
                  Edit quiz
                </Link>
                {quiz.status === "pending_review" && (
                  <ApproveQuizButton quizId={quiz.id} />
                )}
              </div>
            </div>
          ) : (
            <div className="panel flex flex-col gap-3 px-4 py-3.5">
              <span className="text-[15px] font-extrabold text-[#5E5A73]">
                No quiz yet
              </span>
              <div className="flex flex-wrap gap-2 [&>button]:flex-1">
                <NewQuizPanel tutors={quizTutors} weeks={[quizTarget]} surface="panel" />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const VIEWER_PILL =
  "h-9 min-h-9 rounded-[11px] border-0 bg-[#F1F2F7] px-3.5 text-[13px] font-extrabold hover:bg-[#E7E9F1]";

function FileSlot({
  kind,
  label,
  currentPath,
  accept,
  pending,
  accent,
  onPick,
  viewerUrl,
  videoViewerUrl,
}: {
  kind: "video" | "booklet";
  label: string;
  currentPath: string | null;
  accept: string;
  pending: boolean;
  /** The subject colour, for the upload button while nothing is uploaded. */
  accent: string;
  onPick: (file: File) => void;
  viewerUrl?: string | null;
  videoViewerUrl?: string | null;
}) {
  const inputId = `file-${kind}`;
  const viewer = cn(MATERIAL_BUTTON, MATERIAL_BUTTON_QUIET, "min-h-10 flex-1 gap-2 rounded-[12px] border-0 text-[14px] font-extrabold");
  return (
    <MaterialCard
      kind={kind}
      title={label}
      status={currentPath ? "Uploaded and visible to learners" : "Not uploaded yet"}
      statusTone={currentPath ? "done" : "waiting"}
    >
      <div className="flex flex-wrap gap-2">
        {videoViewerUrl ? (
          <VideoViewerButton url={videoViewerUrl} title={label} className={viewer}>
            Watch video
          </VideoViewerButton>
        ) : null}
        {viewerUrl ? (
          <PdfViewerButton url={viewerUrl} title={label} className={viewer}>
            View PDF
          </PdfViewerButton>
        ) : null}
        <label
          htmlFor={inputId}
          className={cn(
            MATERIAL_BUTTON,
            "flex-1 gap-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
            currentPath ? MATERIAL_BUTTON_QUIET : "text-white hover:opacity-90",
            pending && "pointer-events-none opacity-60",
          )}
          style={currentPath ? undefined : { background: accent }}
        >
          <ActionButtonLabel pending={pending} pendingLabel="Uploading…">
            {currentPath ? "Replace file" : "Upload file"}
          </ActionButtonLabel>
          <input
            id={inputId}
            type="file"
            accept={accept}
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPick(file);
            }}
            className="sr-only"
          />
        </label>
      </div>
    </MaterialCard>
  );
}
