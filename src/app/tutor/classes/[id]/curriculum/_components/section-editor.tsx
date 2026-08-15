"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  BookOpen,
  Check,
  FileText,
  Library,
  Link2 as LinkIcon,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  Upload,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { promoteAttachment } from "@/app/_actions/resources";
import {
  addTutorWeekAttachment,
  addTutorWeekLink,
  createHomework,
  removeTutorWeekAttachment,
  upsertTutorWeekNote,
} from "@/app/tutor/_actions";
import { formatDueDate } from "@/lib/format";
import { RESOURCE_TYPES } from "@/lib/resource-types";
import { httpHref } from "@/lib/safe-url";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import { WeekObjectives } from "@/components/subjects/week-objectives";
import type { TutorCurriculumWeek, TutorSectionAttachment } from "../_queries";

type AttachmentWithUrl = TutorSectionAttachment & { url: string | null };

export function SectionEditor({
  classId,
  week,
  subjectName,
  topics,
  videoSignedUrl,
  bookletSignedUrl,
  attachmentsWithUrls,
}: {
  classId: string;
  week: TutorCurriculumWeek;
  subjectName: string;
  topics: Array<{ id: string; name: string }>;
  videoSignedUrl: string | null;
  bookletSignedUrl: string | null;
  attachmentsWithUrls: AttachmentWithUrl[];
}) {
  // Subject colour is spent only on the hero head block.
  const tokens = getAccentTokens(colorFamilyForSubject(subjectName));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitNote(formData: FormData) {
    formData.set("classId", classId);
    formData.set("subjectWeekId", week.subjectWeekId);
    setError(null);
    startTransition(async () => {
      const res = await upsertTutorWeekNote(formData);
      if (!res.ok) setError(res.error);
    });
  }

  function submitAttachment(formData: FormData) {
    formData.set("classId", classId);
    formData.set("subjectWeekId", week.subjectWeekId);
    setError(null);
    startTransition(async () => {
      const res = await addTutorWeekAttachment(formData);
      if (!res.ok) setError(res.error);
    });
  }

  function submitLink(formData: FormData) {
    formData.set("classId", classId);
    formData.set("subjectWeekId", week.subjectWeekId);
    setError(null);
    startTransition(async () => {
      const res = await addTutorWeekLink(formData);
      if (!res.ok) setError(res.error);
    });
  }

  function handleRemove(attachmentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeTutorWeekAttachment(attachmentId, classId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3.5">
      {/* HERO - the one coloured head block, subject-tinted */}
      <section
        className="relative overflow-hidden rounded-[22px] px-5 py-4 text-white shadow-[0_14px_32px_-18px_rgba(31,40,90,0.5)]"
        style={{
          background: `linear-gradient(135deg, ${tokens.arrow} 0%, ${tokens.title} 100%)`,
        }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          className="absolute -right-8 -top-12 w-[190px] h-[190px] opacity-50 pointer-events-none"
          fill="none"
        >
          <circle cx="70" cy="30" r="32" fill="rgba(255,255,255,0.12)" />
          <circle cx="70" cy="30" r="20" fill="rgba(255,255,255,0.10)" />
          <circle cx="70" cy="30" r="10" fill="rgba(255,255,255,0.14)" />
        </svg>
        <div className="relative z-10">
          <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold opacity-85">
            Week {week.weekNumber}
          </div>
          <h2 className="m-0 mt-0.5 text-[22px] lg:text-[26px] font-extrabold tracking-[-0.02em] leading-tight">
            {week.title}
          </h2>
        </div>
      </section>

      {/* ONE connected block - split by dividers */}
      <div className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_1px_2px_rgba(15,17,30,0.04),0_14px_30px_-18px_rgba(31,40,90,0.24)] divide-y divide-line">
        {/* Overview + base content (set by admin, read-only) */}
        <section className="p-4 lg:p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-[10px] grid place-items-center shrink-0 bg-surface-2 text-muted">
              <BookOpen className="h-4 w-4" />
            </span>
            <h3 className="m-0 text-[15px] font-extrabold tracking-[-0.01em] text-ink">
              Overview
            </h3>
            <span className="ml-auto text-[10px] uppercase tracking-[0.14em] font-bold text-muted">
              Set by admin
            </span>
          </div>
          {week.description ? (
            <div className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap">
              {week.description}
            </div>
          ) : (
            !week.objectives?.trim() && (
              <div className="text-[13px] text-muted italic">
                No overview set for this week yet.
              </div>
            )
          )}
          <WeekObjectives objectives={week.objectives} />
          {(videoSignedUrl || bookletSignedUrl) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {videoSignedUrl && (
                <a
                  href={videoSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-bold text-ink hover:bg-surface transition-colors"
                >
                  <PlayCircle className="h-4 w-4 text-muted" /> Watch video
                </a>
              )}
              {bookletSignedUrl && (
                <a
                  href={bookletSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-bold text-ink hover:bg-surface transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted" /> Booklet
                </a>
              )}
            </div>
          )}
        </section>

        {/* Approved quiz */}
        {week.quiz && (
          <section className="p-4 lg:p-5">
            <Link
              href={`/tutor/quizzes/${week.quiz.id}`}
              className="group flex items-center gap-4 rounded-[14px] border border-line bg-surface-2 p-4 transition-colors hover:bg-surface"
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-surface text-muted"
              >
                <ListChecks className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  Approved weekly quiz
                </span>
                <span className="mt-0.5 block text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                  {week.quiz.title}
                </span>
                <span className="mt-0.5 block text-[12px] font-semibold text-muted">
                  {week.quiz.questionCount}{" "}
                  {week.quiz.questionCount === 1 ? "question" : "questions"}
                </span>
              </span>
              <span className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-[12px] font-bold text-ink transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                Preview <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </section>
        )}

        {/* Tutor notes - edit-locked */}
        <section className="p-4 lg:p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-8 w-8 rounded-[10px] grid place-items-center shrink-0 bg-surface-2 text-muted">
              <Pencil className="h-4 w-4" />
            </span>
            <h3 className="m-0 text-[15px] font-extrabold tracking-[-0.01em] text-ink">
              Tutor notes
            </h3>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setEditing((v) => !v);
              }}
              className={
                "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors " +
                (editing
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "border border-line text-ink hover:bg-surface-2")
              }
            >
              {editing ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Done
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </>
              )}
            </button>
          </div>

          {/* Read-only view */}
          {!editing && (
            <div className="space-y-3">
              {week.note ? (
                <div className="text-[14px] text-ink-soft leading-relaxed whitespace-pre-wrap">
                  {week.note}
                </div>
              ) : (
                <div className="text-[13px] text-muted italic">
                  No notes yet. Click Edit to add notes, files, or links for your
                  students.
                </div>
              )}
              {attachmentsWithUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachmentsWithUrls.map((att) => (
                    <AttachmentChip key={att.id} att={att} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit view */}
          {editing && (
            <div className="space-y-5">
              {/* Note */}
              <form action={submitNote} className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
                  Note
                </div>
                <textarea
                  name="note"
                  defaultValue={week.note ?? ""}
                  rows={4}
                  placeholder="Add notes for your students… (e.g. what you actually covered, tips, corrections)"
                  className="w-full rounded-[12px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong transition-colors"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save note"}
                </button>
              </form>

              {/* Existing attachments with remove */}
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
                  Files &amp; links
                </div>
                {attachmentsWithUrls.length === 0 ? (
                  <div className="text-[13px] text-muted italic">
                    Nothing added yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {attachmentsWithUrls.map((att) => (
                      <li
                        key={att.id}
                        className="space-y-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          {att.kind === "link" ? (
                            <LinkIcon className="h-4 w-4 shrink-0 text-muted" />
                          ) : (
                            <FileText className="h-4 w-4 shrink-0 text-muted" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                            {att.fileName}
                          </span>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRemove(att.id)}
                            aria-label={`Remove ${att.fileName}`}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-bad/40 text-bad px-2 py-1 text-[11px] font-bold hover:bg-bad-bg disabled:opacity-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                        <PromoteControl
                          attachmentId={att.id}
                          promoted={att.promoted}
                          topics={topics}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Upload file */}
              <form
                action={submitAttachment}
                className="flex flex-wrap items-center gap-2 rounded-[12px] border-2 border-dashed border-line bg-surface-2 p-3"
              >
                <Upload className="h-4 w-4 shrink-0 text-muted" />
                <input
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
                  className="text-[13px] flex-1 min-w-[160px] file:mr-2 file:rounded-md file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[12px] file:font-bold file:text-ink file:cursor-pointer cursor-pointer"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {pending ? "Uploading…" : "Upload file"}
                </button>
              </form>

              {/* Add link */}
              <form
                action={submitLink}
                className="flex flex-wrap items-center gap-2 rounded-[12px] border border-line p-3"
              >
                <LinkIcon className="h-4 w-4 shrink-0 text-muted" />
                <input
                  name="label"
                  required
                  maxLength={200}
                  placeholder="Label (e.g. Khan Academy video)"
                  className="flex-1 min-w-[140px] rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
                />
                <input
                  name="url"
                  type="url"
                  required
                  maxLength={2000}
                  placeholder="https://…"
                  className="flex-[2] min-w-[180px] rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add link
                </button>
              </form>
            </div>
          )}

          {error && (
            <div className="mt-3 text-[13px] font-semibold text-bad">{error}</div>
          )}
        </section>

        {/* Homework */}
        <section className="p-4 lg:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-[10px] grid place-items-center shrink-0 bg-surface-2 text-muted">
              <FileText className="h-4 w-4" />
            </span>
            <h3 className="m-0 text-[15px] font-extrabold tracking-[-0.01em] text-ink">
              Homework for this week
            </h3>
          </div>
          <div className="text-[12px] text-muted">
            Shared across all your {subjectName} classes.
          </div>

          {week.homework.length === 0 ? (
            <div className="text-[13px] text-muted italic">
              No homework assigned to this week yet.
            </div>
          ) : (
            <ul className="divide-y divide-line rounded-[12px] border border-line overflow-hidden">
              {week.homework.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/tutor/homework/${h.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-ink truncate">
                        {h.title}
                      </div>
                      <div className="text-[12px] text-muted">
                        Due {formatDueDate(h.dueDate)}
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.12em] font-bold shrink-0 text-muted">
                      Open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <form
            action={createHomework}
            className="space-y-3 border-t border-line pt-4"
          >
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="weekId" value={week.subjectWeekId} />
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
              Add new homework
            </div>
            <input
              name="title"
              required
              placeholder="e.g. Practice problems 1-10"
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                name="dueDate"
                type="datetime-local"
                required
                className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-line-strong"
              />
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  name="allowResubmission"
                  className="accent-ink"
                />
                Allow resubmission
              </label>
            </div>
            <div>
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                <input type="checkbox" name="isTest" className="accent-ink" />
                Mark as test
              </label>
              <p className="mt-1 pl-6 text-[12px] text-muted">
                Counts toward anonymous student rankings for this subject.
              </p>
            </div>
            <textarea
              name="description"
              rows={2}
              placeholder="Description (optional)"
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
            />
            <input
              name="attachment"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="text-[13px] file:mr-2 file:rounded-md file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-[12px] file:font-bold file:text-ink file:cursor-pointer cursor-pointer"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-brand-700"
            >
              <Plus className="h-3.5 w-3.5" /> Assign homework
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function PromoteControl({
  attachmentId,
  promoted,
  topics,
}: {
  attachmentId: string;
  promoted: boolean;
  topics: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(promoted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-good">
        <Check className="h-3.5 w-3.5" /> In library
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-surface transition-colors"
      >
        <Library className="h-3 w-3 text-muted" /> Also publish to library
      </button>
    );
  }

  function submit(formData: FormData) {
    formData.set("attachmentId", attachmentId);
    setError(null);
    startTransition(async () => {
      const res = await promoteAttachment(formData);
      if (!res.ok) {
        setError(res.error);
      } else {
        setDone(true);
        setOpen(false);
      }
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <select
        name="type"
        required
        defaultValue=""
        className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[12px] text-ink focus:outline-none focus:border-line-strong"
      >
        <option value="" disabled>
          Type…
        </option>
        {RESOURCE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        name="topicId"
        defaultValue=""
        className="rounded-[8px] border border-line bg-surface px-2 py-1.5 text-[12px] text-ink focus:outline-none focus:border-line-strong"
      >
        <option value="">No topic</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Publishing…" : "Publish"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] font-bold text-muted hover:text-ink"
      >
        Cancel
      </button>
      {error && (
        <div className="w-full text-[12px] font-semibold text-bad">{error}</div>
      )}
    </form>
  );
}

function AttachmentChip({ att }: { att: AttachmentWithUrl }) {
  const Icon = att.kind === "link" ? LinkIcon : FileText;
  const href = httpHref(att.url);
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12px] font-semibold text-ink hover:bg-surface transition-colors"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
      {att.fileName}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12px] font-semibold text-muted">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {att.fileName}
    </span>
  );
}
