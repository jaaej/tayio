"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createHomework,
  resetClassWeekOverride,
  upsertClassWeekOverride,
  uploadTutorOverrideBooklet,
  uploadTutorOverrideVideo,
} from "@/app/tutor/_actions";
import { formatDueDate } from "@/lib/format";
import type { TutorCurriculumWeek } from "../_queries";

export function OverrideEditor({
  classId,
  week,
}: {
  classId: string;
  week: TutorCurriculumWeek;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("classId", classId);
    formData.set("subjectWeekId", week.subjectWeekId);
    setError(null);
    startTransition(async () => {
      const res = await upsertClassWeekOverride(formData);
      if (!res.ok) setError(res.error);
    });
  }

  function handleUpload(kind: "video" | "booklet", file: File) {
    const fd = new FormData();
    fd.set("file", file);
    setError(null);
    startTransition(async () => {
      const res =
        kind === "video"
          ? await uploadTutorOverrideVideo(classId, week.subjectWeekId, fd)
          : await uploadTutorOverrideBooklet(classId, week.subjectWeekId, fd);
      if (!res.ok) setError(res.error);
    });
  }

  const hasAnyOverride =
    week.overrideTitle ||
    week.overrideDescription ||
    week.overrideVideoUrl ||
    week.overrideBookletUrl;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs uppercase tracking-[0.18em] text-muted">
          Week {week.weekNumber} · template
        </div>
        <h2 className="text-2xl font-medium text-ink">{week.title}</h2>
        {week.description && (
          <p className="text-sm text-ink-soft">{week.description}</p>
        )}
      </header>

      <section className="rounded-xl border border-hairline/60 bg-card p-5 space-y-4">
        <div className="text-sm font-medium text-ink">
          Override for this class
        </div>

        <form action={submit} className="space-y-3">
          <label className="block text-sm">
            <div className="text-xs uppercase tracking-wide text-muted mb-1">
              Title (override)
            </div>
            <input
              name="title"
              defaultValue={week.overrideTitle ?? ""}
              placeholder={week.templateTitle}
              className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <div className="text-xs uppercase tracking-wide text-muted mb-1">
              Description (override)
            </div>
            <textarea
              name="description"
              defaultValue={week.overrideDescription ?? ""}
              placeholder={week.templateDescription ?? ""}
              rows={3}
              className="w-full rounded-md border border-hairline/60 bg-card px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save text overrides"}
            </button>
            {hasAnyOverride && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      "Reset to template? Override file paths will also be cleared.",
                    )
                  ) {
                    startTransition(async () => {
                      const res = await resetClassWeekOverride(
                        classId,
                        week.subjectWeekId,
                      );
                      if (!res.ok) setError(res.error);
                    });
                  }
                }}
                className="rounded-md border border-red-300 text-red-700 px-3 py-2 text-sm"
              >
                Reset to template
              </button>
            )}
          </div>
        </form>

        <div className="border-t border-hairline/60 pt-4 space-y-3">
          <div className="text-sm font-medium text-ink">Files</div>
          <FileSlot
            label="Video"
            currentPath={week.overrideVideoUrl ?? week.templateVideoUrl}
            isOverride={Boolean(week.overrideVideoUrl)}
            accept="video/*"
            onPick={(f) => handleUpload("video", f)}
          />
          <FileSlot
            label="Booklet (PDF)"
            currentPath={week.overrideBookletUrl ?? week.templateBookletUrl}
            isOverride={Boolean(week.overrideBookletUrl)}
            accept="application/pdf"
            onPick={(f) => handleUpload("booklet", f)}
          />
        </div>

        {error && <div className="text-sm text-red-700">{error}</div>}
      </section>

      <section className="rounded-xl border border-hairline/60 bg-card p-5 space-y-4">
        <div className="text-sm font-medium text-ink">Homework for this week</div>

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

function FileSlot({
  label,
  currentPath,
  isOverride,
  accept,
  onPick,
}: {
  label: string;
  currentPath: string | null;
  isOverride: boolean;
  accept: string;
  onPick: (f: File) => void;
}) {
  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="rounded-xl border border-hairline/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">
            {label}
            {isOverride && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700">
                (override)
              </span>
            )}
          </div>
          <div className="text-xs text-ink-soft mt-0.5 truncate">
            {currentPath ? `Stored: ${currentPath}` : "No file uploaded yet"}
          </div>
        </div>
        <label
          htmlFor={inputId}
          className="shrink-0 cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          {currentPath ? "Replace" : "Upload"}
        </label>
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
          className="hidden"
        />
      </div>
    </div>
  );
}
