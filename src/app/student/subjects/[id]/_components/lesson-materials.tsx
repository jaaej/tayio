"use client";

import { useState } from "react";
import { FileText, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChecklistTask } from "../../_lib/week-checklist";
import { BookletLink } from "./booklet-link";
import { VideoPlayer } from "./video-player";

const BUTTON =
  "flex h-10 w-full items-center justify-center rounded-[12px] text-[14px] font-extrabold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

/**
 * "Lesson & materials": the recorded lesson and the week booklet side by
 * side. Watch opens the player under the cards (playing it ticks the lesson
 * off); the booklet opens in the PDF viewer and counts as opened.
 */
export function LessonMaterials({
  video,
  booklet,
  videoSrc,
  subjectWeekId,
  accent,
}: {
  video: ChecklistTask;
  booklet: ChecklistTask;
  videoSrc: string | null;
  subjectWeekId: string;
  /** The subject colour, for the button of work not done yet. */
  accent: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <section aria-labelledby="lm-h" className="glass flex flex-col gap-1.5 rounded-[24px] p-1.5">
      <h2 id="lm-h" className="m-0 px-3 pb-1 pt-2 text-[16px] font-extrabold">
        Lesson &amp; materials
      </h2>
      <div className="grid gap-1.5 sm:grid-cols-2">
        <MaterialCard
          task={video}
          icon={<Play className="h-[18px] w-[18px]" aria-hidden />}
          iconTone={{ bg: "#E4ECFF", fg: "#3B6BFF" }}
        >
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
        <MaterialCard
          task={booklet}
          icon={<FileText className="h-[18px] w-[18px]" aria-hidden />}
          iconTone={{ bg: "#FDF1E0", fg: "#B45309" }}
        >
          {booklet.state === "waiting" ? (
            <NotReady />
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
              alreadyWatched={video.state === "done"}
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

function buttonClass(task: ChecklistTask): string {
  return cn(BUTTON, task.state === "done" ? "bg-[#F1F2F7] text-ink hover:bg-[#E7E9F1]" : "text-white hover:opacity-90");
}

function buttonStyle(task: ChecklistTask, accent: string): React.CSSProperties | undefined {
  return task.state === "done" ? undefined : { background: accent };
}

function NotReady() {
  return (
    <span aria-disabled className={cn(BUTTON, "bg-[#F1F2F7] text-[#8C8AA0]")}>
      Not ready
    </span>
  );
}

function MaterialCard({
  task,
  icon,
  iconTone,
  children,
}: {
  task: ChecklistTask;
  icon: React.ReactNode;
  iconTone: { bg: string; fg: string };
  children: React.ReactNode;
}) {
  const meta =
    task.state === "waiting"
      ? { text: "Not uploaded yet", color: "#9A4A07" }
      : task.state === "done"
        ? { text: task.meta, color: "#15803D" }
        : { text: task.meta, color: "#5E5A73" };
  return (
    <div className="panel flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
          style={{ background: iconTone.bg, color: iconTone.fg }}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[16px] font-extrabold leading-tight">{task.title}</span>
          <span className="text-[13px] font-bold" style={{ color: meta.color }}>
            {meta.text}
          </span>
        </span>
      </div>
      {children}
    </div>
  );
}
