"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, GlassPanel } from "@/components/admin/ui";
import { ActionSpinner } from "@/components/ui/loading-button";
import { VideoViewerButton } from "@/components/ui/video-viewer";
import { saveLessonRecording } from "@/app/tutor/_actions";

/** Optional hosted-video link for this lesson (the class's own recording, not
 *  the admin's week video); students watch it from Recorded lessons. */
export function RecordingCard({
  lessonId,
  recordingUrl,
  title,
}: {
  lessonId: string;
  recordingUrl: string | null;
  title: string;
}) {
  const router = useRouter();
  const headingId = useId();
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      try {
        await saveLessonRecording(formData);
      } catch {
        setError("Enter a valid link starting with https://");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <GlassPanel
      id="recording"
      title="Class recording"
      titleId={headingId}
      action={
        <span className={recordingUrl ? "pr-1.5 text-[12px] font-bold text-good" : "pr-1.5 text-[12px] font-bold text-ink-soft"}>
          {recordingUrl ? "Link added" : "Optional"}
        </span>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-2 p-3.5">
        <input type="hidden" name="lessonId" value={lessonId} />
        <label htmlFor={inputId} className="sr-only">
          Video link
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            name="recordingUrl"
            type="url"
            inputMode="url"
            defaultValue={recordingUrl ?? ""}
            placeholder="Paste a video link"
            onChange={() => setSaved(false)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="h-10 min-w-0 flex-1 rounded-[11px] border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="h-10 shrink-0 rounded-[11px] px-3.5"
          >
            {pending && <ActionSpinner />}
            Save link
          </Button>
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-[12px] font-semibold text-bad">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] leading-[1.45] text-muted">
            Students watch it from Recorded lessons. Clear the link and save to remove it.
          </p>
          {saved && (
            <span role="status" className="inline-flex items-center gap-1 text-[12px] font-bold text-good">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Saved
            </span>
          )}
        </div>
        {recordingUrl && (
          <VideoViewerButton url={recordingUrl} title={title} className="self-start">
            Preview recording
          </VideoViewerButton>
        )}
      </form>
    </GlassPanel>
  );
}
