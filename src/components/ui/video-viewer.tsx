"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, PlayCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

function hostedEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.startsWith("/embed/")
          ? url.pathname.split("/").filter(Boolean)[1]
          : null;
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments.find((segment) => /^\d+$/.test(segment));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "drive.google.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const fileIndex = segments.indexOf("d");
    const id =
      fileIndex >= 0 ? segments[fileIndex + 1] : url.searchParams.get("id");
    return id
      ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`
      : null;
  }
  if (host === "loom.com" || host === "www.loom.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const shareIndex = segments.indexOf("share");
    const id = shareIndex >= 0 ? segments[shareIndex + 1] : null;
    return id ? `https://www.loom.com/embed/${encodeURIComponent(id)}` : null;
  }
  return null;
}

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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/75 p-2 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-6xl flex-col overflow-hidden rounded-[18px] border border-white/20 bg-surface shadow-2xl"
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
