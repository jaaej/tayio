"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createHomework,
  upsertTutorWeekNote,
  addTutorWeekAttachment,
  removeTutorWeekAttachment,
} from "@/app/tutor/_actions";
import { formatDueDate } from "@/lib/format";
import type { TutorCurriculumWeek, TutorSectionAttachment } from "../_queries";

type AttachmentWithUrl = TutorSectionAttachment & { url: string | null };

export function SectionEditor({
  classId,
  week,
  subjectName,
  videoSignedUrl,
  bookletSignedUrl,
  attachmentsWithUrls,
}: {
  classId: string;
  week: TutorCurriculumWeek;
  subjectName: string;
  videoSignedUrl: string | null;
  bookletSignedUrl: string | null;
  attachmentsWithUrls: AttachmentWithUrl[];
}) {
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

  function handleRemove(attachmentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeTutorWeekAttachment(attachmentId, classId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Base content — read-only, set by admin */}
      <section className="rounded-xl border border-hairline/60 bg-card p-5 space-y-3">
        <div className="text-xs uppercase tracking-[0.18em] text-muted font-semibold">
          Set by admin
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted mb-0.5">
            Week {week.weekNumber}
          </div>
          <h2 className="text-xl font-semibold text-ink">{week.title}</h2>
          {week.description && (
            <p className="text-sm text-ink-soft mt-1">{week.description}</p>
          )}
        </div>
        {(videoSignedUrl || bookletSignedUrl) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {videoSignedUrl && (
              <a
                href={videoSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
              >
                ▶ Watch video
              </a>
            )}
            {bookletSignedUrl && (
              <a
                href={bookletSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
              >
                ↓ Download booklet
              </a>
            )}
          </div>
        )}
      </section>

      {/* Tutor's editable section */}
      <section className="rounded-xl border border-hairline/60 bg-card p-5 space-y-4">
        <div className="text-sm font-medium text-ink">Your section</div>

        <form action={submitNote} className="space-y-3">
          <label className="block text-sm">
            <div className="text-xs uppercase tracking-wide text-muted mb-1">
              Note
            </div>
            <textarea
              name="note"
              defaultValue={week.note ?? ""}
              rows={4}
              placeholder="Add notes for your students…"
              className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save note"}
          </button>
        </form>

        <div className="border-t border-hairline/60 pt-4 space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted">
            Attachments
          </div>
          {attachmentsWithUrls.length === 0 ? (
            <div className="text-sm text-ink-soft italic">No attachments yet.</div>
          ) : (
            <ul className="divide-y divide-hairline/60 rounded-lg border border-hairline/60 overflow-hidden">
              {attachmentsWithUrls.map((att) => (
                <li
                  key={att.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    {att.url ? (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand-700 hover:underline truncate block"
                      >
                        {att.fileName}
                      </a>
                    ) : (
                      <span className="text-sm text-ink truncate block">
                        {att.fileName}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleRemove(att.id)}
                    className="shrink-0 rounded-md border border-red-300 text-red-700 px-3 py-1 text-xs hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            action={submitAttachment}
            encType="multipart/form-data"
            className="flex items-center gap-2"
          >
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt"
              className="text-sm flex-1"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-md bg-brand-600 text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Uploading…" : "Upload"}
            </button>
          </form>
        </div>

        {error && <div className="text-sm text-red-700">{error}</div>}
      </section>

      {/* Homework block — verbatim from override-editor.tsx */}
      <section className="rounded-xl border border-hairline/60 bg-card p-5 space-y-4">
        <div className="text-sm font-medium text-ink">Homework for this week</div>
        <div className="text-xs text-ink-soft">
          Shared across all your {subjectName} classes.
        </div>

        {week.homework.length === 0 ? (
          <div className="text-sm text-ink-soft italic">
            No homework assigned to this week yet.
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60 rounded-lg border border-hairline/60 overflow-hidden">
            {week.homework.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/tutor/homework/${h.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-ink truncate">{h.title}</div>
                    <div className="text-xs text-muted">
                      Due {formatDueDate(h.dueDate)}
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-brand-700 shrink-0">
                    Open →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <form
          action={createHomework}
          encType="multipart/form-data"
          className="space-y-3 border-t border-hairline/60 pt-4"
        >
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="weekId" value={week.subjectWeekId} />
          <div className="text-xs uppercase tracking-wide text-muted">
            Add new homework
          </div>
          <label className="block text-sm">
            <div className="text-xs text-ink-soft mb-1">Title</div>
            <input
              name="title"
              required
              placeholder="e.g. Practice problems 1-10"
              className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <div className="text-xs text-ink-soft mb-1">Due</div>
              <input
                name="dueDate"
                type="datetime-local"
                required
                className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
              />
            </label>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input
                type="checkbox"
                name="allowResubmission"
                className="accent-ink"
              />
              Allow resubmission
            </label>
          </div>
          <label className="block text-sm">
            <div className="text-xs text-ink-soft mb-1">Description</div>
            <textarea
              name="description"
              rows={2}
              className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <div className="text-xs text-ink-soft mb-1">
              Attachment (optional)
            </div>
            <input
              name="attachment"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            Assign homework
          </button>
        </form>
      </section>
    </div>
  );
}
