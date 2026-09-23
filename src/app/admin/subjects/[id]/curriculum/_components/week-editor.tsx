"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  HelpCircle,
  Pencil,
  PlayCircle,
  Settings2,
} from "lucide-react";
import { Button, Pill, type PillTone } from "@/components/admin/ui";
import { HeroBackLink } from "@/components/subjects/hero-back-link";
import { WeekObjectives } from "@/components/subjects/week-objectives";
import { SidePanel } from "@/components/ui/side-panel";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
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

export function WeekEditor({
  existing,
  subjectId,
  termId,
  topics,
  subjectName,
  weekCounts,
  quiz,
  quizTutors,
  quizTarget,
  bookletSignedUrl,
  videoSignedUrl,
}: {
  existing?: SubjectWeek;
  subjectId: string;
  termId: string;
  topics: { id: string; name: string; position: number }[];
  subjectName: string;
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
}) {
  const router = useRouter();
  const tokens = getAccentTokens(colorFamilyForSubject(subjectName));
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

  return (
    <div className="space-y-3.5">
      <section
        className="relative -mt-3 -mr-3 overflow-hidden rounded-none px-5 py-4 text-white shadow-[0_14px_32px_-18px_rgba(31,40,90,0.5)] lg:-ml-4 lg:-mr-4 lg:px-7"
        style={{
          background: `radial-gradient(140% 160% at 0% 0%, ${withAlpha(tokens.bgFrom, 0.65)} 0%, transparent 45%), radial-gradient(120% 140% at 100% 0%, ${withAlpha(tokens.bgFrom, 0.4)} 0%, transparent 55%), linear-gradient(135deg, ${tokens.arrow} 0%, ${tokens.title} 100%)`,
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -right-8 -top-12 h-[200px] w-[200px] opacity-50"
          fill="none"
        >
          <circle cx="70" cy="30" r="34" fill="rgba(255,255,255,0.12)" />
          <circle cx="70" cy="30" r="22" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="11" fill="rgba(255,255,255,0.14)" />
        </svg>
        <HeroBackLink href="/admin/classes">← All classes</HeroBackLink>
        <div className="relative z-10 mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-85">
              {existing ? `Week ${existing.weekNumber}` : "New curriculum week"}
            </div>
            <h2 className="m-0 mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] lg:text-[26px]">
              {existing?.title ?? `Add to ${subjectName}`}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <HeroButton onClick={() => setTopicsOpen(true)}>
              <Settings2 className="h-4 w-4" /> Manage topics
            </HeroButton>
            {existing && (
              <HeroButton onClick={() => setEditorOpen(true)}>
                <Pencil className="h-4 w-4" /> Edit week
              </HeroButton>
            )}
          </div>
        </div>
      </section>

      <div className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_1px_2px_rgba(15,17,30,0.04),0_14px_30px_-18px_rgba(31,40,90,0.24)]">
        {existing ? (
          <>
            <section
              className="space-y-3 p-4 lg:p-5"
              style={{
                backgroundColor: tokens.title,
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tokens.arrow} 65%, ${tokens.title}) 0%, ${tokens.title} 100%)`,
              }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-white/15 text-white">
                  <BookOpen className="h-4 w-4" />
                </span>
                <h3 className="text-[15px] font-extrabold text-white">Overview</h3>
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-bold"
                  style={{ color: tokens.title }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit overview
                </button>
              </div>
              {existing.description ? (
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">
                  {existing.description}
                </p>
              ) : (
                <p className="text-[13px] italic text-white/70">
                  No overview has been added yet.
                </p>
              )}
              <WeekObjectives objectives={existing.objectives} onDark />
            </section>

            <section className="space-y-4 p-4 lg:p-5">
              <div>
                <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                  Lesson &amp; materials
                </h3>
                <p className="mt-0.5 text-[12px] text-muted">
                  These are the video and booklet students see for this week.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FileSlot
                  icon={<PlayCircle className="h-5 w-5" />}
                  label="Recorded lesson"
                  currentPath={existing.videoUrl}
                  accept="video/*"
                  pending={pending}
                  onPick={(file) => handleUpload("video", file)}
                  videoViewerUrl={videoSignedUrl}
                />
                <FileSlot
                  icon={<FileText className="h-5 w-5" />}
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
                  className="rounded-[10px] bg-bad-bg px-3 py-2 text-[13px] font-semibold text-bad"
                >
                  {error}
                </p>
              )}
            </section>

            <section className="space-y-4 p-4 lg:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-50 text-brand-700">
                      <HelpCircle className="h-4 w-4" aria-hidden />
                    </span>
                    <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                      Weekly quiz
                    </h3>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    Create the quiz here yourself or ask a tutor to prepare it.
                  </p>
                </div>
                {!quiz && quizTarget ? (
                  <div className="flex flex-wrap gap-2">
                    <NewQuizPanel
                      tutors={quizTutors ?? []}
                      weeks={[quizTarget]}
                    />
                  </div>
                ) : null}
              </div>

              {quiz ? (
                <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-surface-2 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-extrabold text-ink">
                        {quiz.title}
                      </span>
                      <Pill
                        tone={(QUIZ_STATUS_TONE[quiz.status] ?? "default") as PillTone}
                        dot
                      >
                        {QUIZ_STATUS_LABEL[quiz.status] ?? quiz.status}
                      </Pill>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {quiz.questionCount} answerable question{quiz.questionCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {quiz.status === "pending_review" ? (
                    <ApproveQuizButton quizId={quiz.id} size="sm" />
                  ) : null}
                  <a
                    href={`/admin/quizzes/${quiz.id}`}
                    className="inline-flex min-h-9 items-center rounded-full border border-line-strong bg-surface px-4 text-[12px] font-bold text-ink transition-colors hover:border-brand-400 hover:text-brand-700"
                  >
                    {quiz.status === "approved" ? "Preview quiz" : "Open quiz builder"}
                  </a>
                </div>
              ) : quizTarget ? (
                <p className="rounded-[12px] border border-dashed border-line-strong bg-surface-2 px-4 py-3 text-[12px] text-muted">
                  No quiz has been attached to this week yet.
                </p>
              ) : null}
            </section>
          </>
        ) : (
          <section className="p-4 lg:p-5">
            <div className="mb-5">
              <h3 className="text-[16px] font-extrabold text-ink">
                Create a curriculum week
              </h3>
              <p className="mt-1 text-[13px] text-muted">
                Add the learner-facing overview first. Materials can be uploaded after saving.
              </p>
            </div>
            {editForm}
          </section>
        )}
      </div>

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

function HeroButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3.5 text-[12px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
    >
      {children}
    </button>
  );
}

function FileSlot({
  icon,
  label,
  currentPath,
  accept,
  pending,
  onPick,
  viewerUrl,
  videoViewerUrl,
}: {
  icon: React.ReactNode;
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
    <div className="flex min-h-[132px] flex-col rounded-[14px] border border-line bg-surface-2 p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-surface text-muted">
          {icon}
        </span>
        <div>
          <div className="text-[14px] font-extrabold text-ink">{label}</div>
          <div className="mt-0.5 text-[12px] text-muted">
            {currentPath ? "Uploaded and visible to learners" : "Nothing uploaded yet"}
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {videoViewerUrl ? (
          <VideoViewerButton url={videoViewerUrl} title={label}>
            Watch video
          </VideoViewerButton>
        ) : null}
        {viewerUrl ? (
          <PdfViewerButton url={viewerUrl} title={label}>
            View PDF
          </PdfViewerButton>
        ) : null}
        <label
          htmlFor={inputId}
          className="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-surface px-3.5 text-[12px] font-bold text-ink ring-1 ring-inset ring-line transition-colors hover:ring-line-strong"
        >
          <ActionButtonLabel pending={pending} pendingLabel="Uploading…">
            {currentPath ? "Replace file" : "Upload file"}
          </ActionButtonLabel>
        </label>
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPick(file);
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}

function withAlpha(rgb: string, alpha: number): string {
  const match = rgb.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (!match) return rgb;
  return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
}
