"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { FileText, Upload, X } from "lucide-react";
import { buttonVariants } from "@/components/admin/ui";
import { ActionSpinner } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // mirrors the submit route
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.heic";

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Upload or typed answer, posted to the submit route as a plain multipart
 * form (it redirects back with `?submitted=1` or `?error=`). The file and
 * empty-answer checks here only save a round-trip; the route enforces both.
 */
export function SubmissionForm({
  homeworkId,
  resubmit,
}: {
  homeworkId: string;
  resubmit: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Coming back to this page from the browser cache must not leave the
  // button stuck on "Submitting".
  useEffect(() => {
    const reset = () => setSubmitting(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  function adopt(next: File | null) {
    if (next && next.size > MAX_FILE_BYTES) {
      setError("That file is over 10 MB. Choose a smaller one.");
      setFile(null);
      if (input.current) input.current.value = "";
      return;
    }
    setError(null);
    setFile(next);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files;
    if (!dropped.length || !input.current) return;
    input.current.files = dropped;
    adopt(dropped[0]);
  }

  function clearFile() {
    if (input.current) input.current.value = "";
    setFile(null);
    setError(null);
  }

  return (
    <form
      action={`/api/student/homework/${homeworkId}/submit`}
      method="post"
      encType="multipart/form-data"
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        const text = new FormData(e.currentTarget).get("text");
        if (!file && !(typeof text === "string" && text.trim())) {
          e.preventDefault();
          setError("Upload a file or type an answer first.");
          return;
        }
        setSubmitting(true);
      }}
    >
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-[13px] font-extrabold text-muted">{resubmit ? "Resubmit your work" : "Your work"}</h3>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed p-[22px] text-center transition-colors duration-150",
            "focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-1",
            dragging ? "border-ink-soft bg-surface-2" : "border-[#DCDEE9] bg-[#FAFBFD]",
            file && "hidden",
          )}
        >
          <Upload className="h-6 w-6 text-[#2E2944]" strokeWidth={1.8} aria-hidden />
          <span className="text-[14px] font-bold text-ink">Upload your work</span>
          <span className="text-[12px] text-muted">PDF, photo or document · 10 MB max</span>
          <input
            ref={input}
            name="file"
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => adopt(e.target.files?.[0] ?? null)}
          />
        </label>

        {file && (
          <div className="flex items-center gap-3 rounded-[12px] bg-surface-2 px-3 py-2.5">
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-ink-soft"
            >
              <FileText className="h-[17px] w-[17px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-bold text-ink">{file.name}</span>
              <span className="text-[12px] text-muted">{formatSize(file.size)}</span>
            </span>
            <button
              type="button"
              onClick={clearFile}
              aria-label={`Remove ${file.name}`}
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2.5 text-[12px] font-bold text-muted">
          <span aria-hidden className="h-px flex-1 bg-line" />
          or type it
          <span aria-hidden className="h-px flex-1 bg-line" />
        </div>

        <textarea
          name="text"
          rows={5}
          aria-label="Your answer"
          placeholder="Write your answer here…"
          onChange={() => error && setError(null)}
          className="w-full resize-y rounded-[12px] border border-[#DCDEE9] bg-surface p-3 text-[14px] leading-[1.55] text-ink placeholder:text-muted focus:border-ink focus:shadow-[0_0_0_3px_rgba(23,21,43,0.10)] focus:outline-none"
        />

        {error && (
          <p role="alert" className="text-[13px] font-semibold text-bad">
            {error}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#EFF0F5] bg-[#FAFBFD] px-4 py-3.5">
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }), "rounded-[11px] px-5")}
        >
          {submitting ? (
            <>
              <ActionSpinner />
              Submitting…
            </>
          ) : resubmit ? (
            "Resubmit"
          ) : (
            "Submit homework"
          )}
        </button>
      </div>
    </form>
  );
}
