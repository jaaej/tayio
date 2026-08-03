"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import {
  createSubjectWeek,
  updateSubjectWeek,
  deleteSubjectWeek,
  uploadAdminVideo,
  uploadAdminBooklet,
} from "@/app/admin/_lib/actions-curriculum";
import type { SubjectWeek } from "@/db/schema";

export function WeekEditor({
  existing,
  subjectId,
  termId,
  topics,
}: {
  existing?: SubjectWeek;
  subjectId: string;
  termId: string;
  topics: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    formData.set("subjectId", subjectId);
    formData.set("termId", termId);
    setError(null);
    startTransition(async () => {
      const res = existing
        ? await updateSubjectWeek(existing.id, formData)
        : await createSubjectWeek(formData);
      if (!res.ok) setError(res.error);
    });
  }

  async function handleUpload(kind: "video" | "booklet", file: File) {
    if (!existing) {
      setError("Save the week first, then upload files.");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    setError(null);
    startTransition(async () => {
      const res =
        kind === "video"
          ? await uploadAdminVideo(existing.id, fd)
          : await uploadAdminBooklet(existing.id, fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      <form action={submit} className="space-y-3">
        <label className="block text-sm">
          <div className="text-[12px] font-bold text-ink-soft mb-1">
            Week number
          </div>
          <input
            name="weekNumber"
            type="number"
            defaultValue={existing?.weekNumber ?? 1}
            className="w-32 rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink"
            required
          />
        </label>
        <label className="block text-sm">
          <div className="text-[12px] font-bold text-ink-soft mb-1">Title</div>
          <input
            name="title"
            defaultValue={existing?.title ?? ""}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink"
            required
          />
        </label>
        <label className="block text-sm">
          <div className="text-[12px] font-bold text-ink-soft mb-1">Topic</div>
          <select
            name="topicId"
            defaultValue={existing?.topicId ?? ""}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink"
          >
            <option value="">Unassigned</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <div className="text-[12px] font-bold text-ink-soft mb-1">
            Description
          </div>
          <textarea
            name="description"
            defaultValue={existing?.description ?? ""}
            rows={3}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : existing ? "Save" : "Create week"}
          </Button>
          {existing && (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (
                  confirm(
                    "Delete this week and all related overrides + progress?",
                  )
                ) {
                  startTransition(async () => {
                    const res = await deleteSubjectWeek(existing.id, subjectId);
                    if (!res.ok) setError(res.error);
                    else
                      window.location.href = `/admin/subjects/${subjectId}/curriculum?term=${termId}`;
                  });
                }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </form>

      {existing && (
        <div className="space-y-4 border-t border-line pt-5">
          <div className="text-[14px] font-bold text-ink">Files</div>
          <FileSlot
            label="Recorded lesson video"
            currentPath={existing.videoUrl}
            accept="video/*"
            onPick={(f) => handleUpload("video", f)}
          />
          <FileSlot
            label="Week booklet (PDF)"
            currentPath={existing.bookletUrl}
            accept="application/pdf"
            onPick={(f) => handleUpload("booklet", f)}
          />
        </div>
      )}

      {error && <div className="text-[13px] font-semibold text-bad">{error}</div>}
    </div>
  );
}

function FileSlot({
  label,
  currentPath,
  accept,
  onPick,
}: {
  label: string;
  currentPath: string | null;
  accept: string;
  onPick: (f: File) => void;
}) {
  const inputId = `file-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-ink">{label}</div>
          <div className="text-xs text-ink-soft mt-0.5 truncate">
            {currentPath ? `Stored: ${currentPath}` : "No file uploaded yet"}
          </div>
        </div>
        <label
          htmlFor={inputId}
          className="shrink-0 cursor-pointer rounded-full bg-brand-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-600 transition-colors"
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
