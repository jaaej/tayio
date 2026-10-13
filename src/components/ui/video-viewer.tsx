"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, PlayCircle, X } from "lucide-react";
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
  title,
  onClose,
}: {
  open: boolean;
  url: string | null;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open || !url || typeof document === "undefined") return null;
  const embedUrl = hostedEmbedUrl(url);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/75 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:rounded-[18px] sm:border sm:border-white/20"
      >
        <header className="flex min-h-14 items-center gap-3 border-b border-line px-4 sm:px-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700">
            <PlayCircle className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink sm:text-[16px]">
            {title}
          </h2>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open video separately"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-bold text-ink hover:bg-surface-2"
          >
            <span className="hidden sm:inline">Open separately</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video player"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
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
      </section>
    </div>,
    document.body,
  );
}
