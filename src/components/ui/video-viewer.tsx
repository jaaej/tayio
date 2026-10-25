"use client";

import { useState, type ReactNode } from "react";
import { PlayCircle } from "lucide-react";
import { ViewerDialog } from "@/components/ui/viewer-dialog";
import { cn } from "@/lib/utils";
import { hostedEmbedUrl } from "@/lib/video-embed";

export function VideoViewerButton({
  url,
  title,
  children = "Watch video",
  className,
}: {
  url: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[12px] font-bold text-ink transition-colors hover:border-line-strong hover:bg-surface-2",
          className,
        )}
      >
        <PlayCircle className="h-4 w-4" aria-hidden />
        {children}
      </button>
      <VideoViewerDialog
        open={open}
        url={url}
        title={title}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function VideoViewerDialog({
  open,
  url,
  downloadUrl,
  title,
  onClose,
}: {
  open: boolean;
  url: string | null;
  downloadUrl?: string | null;
  title: string;
  onClose: () => void;
}) {
  if (!url) return null;
  const embedUrl = hostedEmbedUrl(url);

  return (
    <ViewerDialog
      open={open}
      title={title}
      icon={PlayCircle}
      noun="video"
      url={url}
      downloadUrl={downloadUrl}
      onClose={onClose}
      fitContent
    >
      <div className="aspect-video max-h-[calc(94vh-56px)] w-full bg-black">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className="h-full w-full"
            allow="accelerated-media; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            key={url}
            src={url}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full bg-black object-contain"
          >
            Your browser cannot play this video. Use Open separately instead.
          </video>
        )}
      </div>
    </ViewerDialog>
  );
}
