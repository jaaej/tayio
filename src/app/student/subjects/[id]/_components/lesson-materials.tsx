"use client";

import { useState } from "react";
import {
  MATERIAL_BUTTON,
  MATERIAL_BUTTON_QUIET,
  MaterialCard,
  MaterialNotReady as NotReady,
} from "@/components/subjects/material-card";
import { PdfViewerDialog } from "@/components/ui/pdf-viewer";
import { cn } from "@/lib/utils";
import type { ChecklistTask } from "../../_lib/week-checklist";
import { BookletLink } from "./booklet-link";
import { VideoPlayer } from "./video-player";

/**
 * "Lesson & materials": the recorded lesson and the week booklet side by
 * side. Watch opens the player under the cards (playing it ticks the lesson
 * off); the booklet opens in the PDF viewer and counts as opened. A parent
 * (`readOnly`) sees the same cards and the child's status, and can watch
 * and open them without ticking anything off for the child.
 */
export function LessonMaterials({
  video,
  booklet,
  videoSrc,
  subjectWeekId,
  accent,
  readOnly,
}: {
  video: ChecklistTask;
  booklet: ChecklistTask;
  videoSrc: string | null;
  subjectWeekId: string;
  /** The subject colour, for the button of work not done yet. */
  accent: string;
  /** A parent's view: the booklet's signed URL, opened without recording it. */
  readOnly?: { bookletSrc: string | null };
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <section aria-labelledby="lm-h" className="glass flex flex-col gap-1.5 rounded-[24px] p-1.5">
      <h2 id="lm-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold">
        Lesson &amp; materials
      </h2>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <MaterialCard kind="video" title={video.title} {...status(video)}>
          {video.state === "waiting" ? (
            <NotReady />
          ) : (
            <button
              type="button"
              aria-expanded={playing}
              aria-controls="recording"
              onClick={() => setPlaying((open) => !open)}
              className={buttonClass(video)}
              style={buttonStyle(video, accent)}
            >
              {playing ? "Hide video" : video.state === "done" ? "Watch again" : "Watch"}
            </button>
          )}
        </MaterialCard>
        <MaterialCard kind="booklet" title={booklet.title} {...status(booklet)}>
          {booklet.state === "waiting" ? (
            <NotReady />
          ) : readOnly ? (
            readOnly.bookletSrc ? (
              <ViewBooklet
                url={readOnly.bookletSrc}
                className={buttonClass(booklet)}
                style={buttonStyle(booklet, accent)}
              />
            ) : (
              <NotReady />
            )
          ) : (
            <BookletLink
              subjectWeekId={subjectWeekId}
              className={buttonClass(booklet)}
              style={buttonStyle(booklet, accent)}
            >
              {booklet.state === "done" ? "Open again" : "Open booklet"}
            </BookletLink>
          )}
        </MaterialCard>
      </div>
      {playing && (
        <div id="recording" className="panel p-3">
          {videoSrc ? (
            <VideoPlayer
              src={videoSrc}
              subjectWeekId={subjectWeekId}
              alreadyWatched={video.state === "done" || Boolean(readOnly)}
            />
          ) : (
            <p className="px-2 py-8 text-center text-[14px] text-[#5E5A73]">
              The recording could not be loaded. Refresh the page to try again.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** The booklet in the PDF viewer, without recording that it was opened. */
function ViewBooklet({
  url,
  className,
  style,
}: {
  url: string;
  className: string;
  style: React.CSSProperties | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        Open booklet
      </button>
      <PdfViewerDialog open={open} url={url} title="Week booklet" onClose={() => setOpen(false)} />
    </>
  );
}

function buttonClass(task: ChecklistTask): string {
  return cn(MATERIAL_BUTTON, task.state === "done" ? MATERIAL_BUTTON_QUIET : "text-white hover:opacity-90");
}

function buttonStyle(task: ChecklistTask, accent: string): React.CSSProperties | undefined {
  return task.state === "done" ? undefined : { background: accent };
}

function status(task: ChecklistTask) {
  return task.state === "waiting"
    ? { status: "Not uploaded yet", statusTone: "waiting" as const }
    : { status: task.meta, statusTone: task.state === "done" ? ("done" as const) : ("neutral" as const) };
}
