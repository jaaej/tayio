"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Trash2, Upload } from "lucide-react";
import {
  prepareHomeworkSolutionUpload,
  updateHomeworkSolution,
} from "@/app/_actions/homework-solutions";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { FileViewerButton } from "@/components/ui/file-viewer";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt";

export function HomeworkSolutionEditor({
  homeworkId,
  hasSolution,
  solutionHref,
  compact = false,
}: {
  homeworkId: string;
  hasSolution: boolean;
  solutionHref: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const prepared = await prepareHomeworkSolutionUpload({
        homeworkId,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!prepared.ok) {
        setError(prepared.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(prepared.value.bucket)
        .uploadToSignedUrl(prepared.value.path, prepared.value.token, file, {
          contentType: prepared.value.contentType,
        });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const result = await updateHomeworkSolution({
        homeworkId,
        uploadTicket: prepared.value.ticket,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (inputRef.current) inputRef.current.value = "";
      setSaved(true);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Remove this homework solution?")) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateHomeworkSolution({ homeworkId, remove: true });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "rounded-[14px] border border-line bg-surface-2",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-good-bg text-good">
          <FileCheck2 className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold text-ink">
            Homework solution
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {hasSolution
              ? "Uploaded. Students can open it after the due date."
              : "Students will only see a solution after the due date."}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {solutionHref && (
            <FileViewerButton
              url={solutionHref}
              title="Homework solution"
              className="min-h-9 px-3 text-[11px]"
            >
              View solution
            </FileViewerButton>
          )}
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-brand-600 px-3 text-[11px] font-bold text-white hover:bg-brand-700">
            <Upload className="h-3.5 w-3.5" aria-hidden />
            <ActionButtonLabel pending={pending} pendingLabel="Uploading…">
              {hasSolution ? "Replace" : "Upload solution"}
            </ActionButtonLabel>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              disabled={pending}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
              }}
            />
          </label>
          {hasSolution && (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              aria-label="Remove homework solution"
              className="grid h-9 w-9 place-items-center rounded-full border border-bad/25 bg-surface text-bad hover:bg-bad-bg disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {saved && (
        <p role="status" className="mt-2 text-[11px] font-semibold text-good">
          Solution updated.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
