"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Pencil, PlayCircle, Settings2 } from "lucide-react";
import {
  Button,
  Empty,
  PageHeader,
  Pill,
  SubjectDot,
  buttonVariants,
  type PillTone,
} from "@/components/admin/ui";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { WeekObjectives } from "@/components/subjects/week-objectives";
import { SidePanel } from "@/components/ui/side-panel";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { HomeworkCreatePanel } from "@/components/homework/homework-create-panel";
import { HomeworkSolutionEditor } from "@/components/homework/homework-solution-editor";
import { FileViewerButton } from "@/components/ui/file-viewer";
import {
  createSubjectWeek,
  updateSubjectWeek,
  deleteSubjectWeek,
  uploadAdminVideo,
  uploadAdminBooklet,
} from "@/app/admin/_lib/actions-curriculum";
import type { SubjectWeek } from "@/db/schema";
import type { QuizTargetWeek } from "@/lib/quiz-queries";
import { QUIZ_STATUS_LABEL, QUIZ_STATUS_TONE } from "@/lib/quiz-status";
import { NewQuizPanel } from "@/app/admin/quizzes/_components/new-quiz-panel";
import { ApproveQuizButton } from "@/app/admin/quizzes/_components/approve-quiz-button";
import { TopicsPanel } from "./topics-panel";
import { formatDueDate } from "@/lib/format";

export function WeekEditor({
  existing,
  subjectId,
  termId,
  topics,
  subjectName,
  subjectColor,
  weekCounts,
  quiz,
  quizTutors,
  quizTarget,
  bookletSignedUrl,
  videoSignedUrl,
  homeworkClasses = [],
  homework = [],
}: {
  existing?: SubjectWeek;
  subjectId: string;
  termId: string;
  topics: { id: string; name: string; position: number }[];
  subjectName: string;
  /** The subject's stored colour (`subjects.color`). */
  subjectColor: string | null;
  weekCounts: Record<string, number>;
  quiz?: {
    id: string;
    title: string;
    status: string;
    questionCount: number;
  } | null;
  quizTutors?: { id: string; name: string }[];
  quizTarget?: QuizTargetWeek;
  bookletSignedUrl?: string | null;
  videoSignedUrl?: string | null;
  homeworkClasses?: Array<{ id: string; label: string }>;
  homework?: Array<{
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("subjectId", subjectId);
    formData.set("termId", termId);
    setError(null);
    startTransition(async () => {
      if (existing) {
        const result = await updateSubjectWeek(existing.id, formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setEditorOpen(false);
        router.refresh();
        return;
      }

      const result = await createSubjectWeek(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${termId}&week=${result.id}`;
    });
  }

  function handleUpload(kind: "video" | "booklet", file: File) {
    if (!existing) {
      setError("Save the week first, then upload files.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    setError(null);
    startTransition(async () => {
      const result =
        kind === "video"
          ? await uploadAdminVideo(existing.id, formData)
          : await uploadAdminBooklet(existing.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function removeWeek() {
    if (!existing) return;
    if (!confirm("Delete this week and all related progress and overrides?")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteSubjectWeek(existing.id, subjectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${termId}`;
    });
  }

  const editForm = (
    <form action={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="Week number">
          <input
            name="weekNumber"
            type="number"
            defaultValue={existing?.weekNumber ?? 1}
            className={INPUT}
            min={1}
            max={20}
            required
          />
        </Field>
        <Field label="Topic">
          <select
            name="topicId"
            defaultValue={existing?.topicId ?? ""}
            className={INPUT}
          >
            <option value="">Unassigned</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Week title">
        <input
          name="title"
          defaultValue={existing?.title ?? ""}
          placeholder="What students are learning this week"
          className={INPUT}
          required
        />
      </Field>
      <Field label="Overview">
        <textarea
          name="description"
          defaultValue={existing?.description ?? ""}
          rows={5}
          placeholder="Give students a short, plain-language overview of the week."
          className={INPUT}
        />
      </Field>
      <Field
        label="Learning objectives"
        hint="One objective per line. These become the learner checklist."
      >
        <textarea
          name="objectives"
          defaultValue={existing?.objectives ?? ""}
          rows={6}
          placeholder={
            "Use alternate and co-interior angle rules\nSolve multi-step angle problems"
          }
          className={INPUT}
        />
      </Field>
      {error && (
        <p
          role="alert"
          className="rounded-[10px] bg-bad-bg px-3 py-2 text-[13px] font-semibold text-bad"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Create week"}
        </Button>
        {existing && (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={removeWeek}
          >
            Delete week
          </Button>
        )}
      </div>
    </form>
  );

  const tutorsForQuiz = quizTutors ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: "/admin/classes", label: "Back to classes" }}
        eyebrow={
          <>
            <SubjectDot subject={subjectName} color={subjectColor} />
            {subjectName} · Curriculum
          </>
        }
        title={
          existing ? `Week ${existing.weekNumber} · ${existing.title}` : "New week"
        }
        actions={
          <>
            <Button
              type="button"
              variant="glass"
              size="lg"
              onClick={() => setTopicsOpen(true)}
            >
              <Settings2 className="h-4 w-4" aria-hidden />
              Manage topics
            </Button>
            {existing && (
              <Button type="button" size="lg" onClick={() => setEditorOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit week
              </Button>
            )}
          </>
        }
      />

      {existing ? (
        <>
          <section
            aria-labelledby="week-overview-heading"
            className="flex flex-col gap-3.5 rounded-[24px] bg-ink p-[22px] text-white"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="week-overview-heading" className="text-[16px] font-extrabold">
                Overview
              </h2>
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-white/25 bg-white/10 px-3 text-[13px] font-bold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit overview
              </button>
            </div>
            {existing.description ? (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/90">
                {existing.description}
              </p>
            ) : (
              <p className="text-[14px] text-white/75">No overview yet.</p>
            )}
            <WeekObjectives objectives={existing.objectives} onDark />
          </section>

          <section
            aria-labelledby="week-materials-heading"
            className="glass flex flex-col rounded-[24px] p-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2.5 pt-2">
              <h2 id="week-materials-heading" className="text-[16px] font-extrabold text-ink">
                Lesson &amp; materials
              </h2>
              <span className="text-[13px] font-semibold text-ink-soft">
                What students see this week
              </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <FileSlot
                icon={<PlayCircle className="h-[18px] w-[18px]" aria-hidden />}
                iconClassName="bg-info-bg text-info"
                label="Recorded lesson"
                currentPath={existing.videoUrl}
                accept="video/*"
                pending={pending}
                onPick={(file) => handleUpload("video", file)}
                videoViewerUrl={videoSignedUrl}
              />
              <FileSlot
                icon={<FileText className="h-[18px] w-[18px]" aria-hidden />}
                iconClassName="bg-warn-bg text-warn"
                label="Week booklet"
                currentPath={existing.bookletUrl}
                accept="application/pdf"
                pending={pending}
                onPick={(file) => handleUpload("booklet", file)}
                viewerUrl={bookletSignedUrl}
              />
            </div>
            {error && !editorOpen && (
              <p
                role="alert"
                className="mt-1.5 rounded-[12px] bg-bad-bg px-3 py-2 text-[13px] font-semibold text-bad"
              >
                {error}
              </p>
            )}
          </section>

          <div className="flex flex-wrap items-start gap-5">
            <GlassPanel
              title="Weekly quiz"
              titleId="week-quiz-heading"
              className="min-w-0 flex-[1_1_300px]"
              action={
                !quiz && quizTarget ? (
                  <NewQuizPanel tutors={tutorsForQuiz} weeks={[quizTarget]} />
                ) : undefined
              }
            >
              {quiz ? (
                <div className="flex flex-col gap-2.5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-extrabold text-ink">
                      {quiz.title}
                    </span>
                    <Pill
                      tone={(QUIZ_STATUS_TONE[quiz.status] ?? "default") as PillTone}
                    >
                      {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
                    </Pill>
                  </div>
                  <span className="text-[13px] text-muted">
                    {quiz.questionCount} answerable question
                    {quiz.questionCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/admin/quizzes/${quiz.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "md",
                        className: "flex-1",
                      })}
                    >
                      Edit quiz
                    </Link>
                    {quiz.status === "pending_review" && (
                      <ApproveQuizButton quizId={quiz.id} />
                    )}
                  </div>
                </div>
              ) : (
                <Empty className="py-8">No quiz for this week yet.</Empty>
              )}
            </GlassPanel>

            <GlassPanel
              title="Homework"
              titleId="week-homework-heading"
              className="min-w-0 flex-[1_1_300px]"
            >
              <div className="border-b border-line p-4">
                <HomeworkCreatePanel
                  actor="admin"
                  weekId={existing.id}
                  classes={homeworkClasses}
                />
              </div>
              {homework.length === 0 ? (
                <Empty className="py-8">No homework for this week yet.</Empty>
              ) : (
                <ul>
                  {homework.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 border-b border-line px-4 py-3 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[14px] font-bold text-ink">
                            {item.title}
                          </h3>
                          <p className="text-[12px] text-muted">
                            {item.className ?? "Subject only"} · Due{" "}
                            {formatDueDate(item.dueDate)}
                          </p>
                        </div>
                        {item.attachmentHref && (
                          <FileViewerButton
                            url={item.attachmentHref}
                            title={`${item.title} attachment`}
                            className={VIEWER_BUTTON}
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
            </GlassPanel>
          </div>
        </>
      ) : (
        <GlassPanel title="Create a curriculum week" titleId="new-week-heading">
          <div className="flex flex-col gap-5 p-5">
            <p className="text-[13px] text-muted">
              Materials can be uploaded after saving.
            </p>
            {editForm}
          </div>
        </GlassPanel>
      )}

      {existing && (
        <SidePanel
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          title={`Edit week ${existing.weekNumber}`}
          sub="Update the learner-facing title, overview, objectives, and topic."
          size="wide"
        >
          {editForm}
        </SidePanel>
      )}

      <SidePanel
        open={topicsOpen}
        onClose={() => setTopicsOpen(false)}
        title="Manage curriculum topics"
        sub="Topics organise the weeks rail. Rename or reorder them without leaving this week."
        size="wide"
      >
        <TopicsPanel
          subjectId={subjectId}
          topics={topics}
          weekCounts={weekCounts}
          embedded
        />
      </SidePanel>
    </div>
  );
}

const VIEWER_BUTTON =
  "h-9 min-h-9 rounded-[10px] border-line-strong px-3 text-[13px] hover:bg-surface-2";

const INPUT =
  "min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/25";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-bold text-ink-soft">{label}</span>
      {children}
      {hint && (
        <span className="block text-[11px] leading-relaxed text-muted">{hint}</span>
      )}
    </label>
  );
}

function FileSlot({
  icon,
  iconClassName,
  label,
  currentPath,
  accept,
  pending,
  onPick,
  viewerUrl,
  videoViewerUrl,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  currentPath: string | null;
  accept: string;
  pending: boolean;
  onPick: (file: File) => void;
  viewerUrl?: string | null;
  videoViewerUrl?: string | null;
}) {
  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ${iconClassName}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-extrabold text-ink">{label}</div>
          <div
            className={`text-[12px] font-semibold ${currentPath ? "text-good" : "text-warn"}`}
          >
            {currentPath ? "Uploaded and visible to learners" : "Nothing uploaded yet"}
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {videoViewerUrl ? (
          <VideoViewerButton
            url={videoViewerUrl}
            title={label}
            className={`flex-1 ${VIEWER_BUTTON}`}
          >
            Watch video
          </VideoViewerButton>
        ) : null}
        {viewerUrl ? (
          <PdfViewerButton
            url={viewerUrl}
            title={label}
            className={`flex-1 ${VIEWER_BUTTON}`}
          >
            View PDF
          </PdfViewerButton>
        ) : null}
        <label
          htmlFor={inputId}
          className={buttonVariants({
            variant: currentPath ? "outline" : "primary",
            size: "md",
            className:
              "flex-1 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400",
          })}
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
    </div>
  );
}
