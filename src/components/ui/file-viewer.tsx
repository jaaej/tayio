"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Eye, ImageIcon, X } from "lucide-react";
import { viewableFileKind } from "@/lib/file-viewer";
import { cn } from "@/lib/utils";
import { PdfViewerButton } from "@/components/ui/pdf-viewer";
import { VideoViewerButton } from "@/components/ui/video-viewer";

export function FileViewerButton({
  url,
  title,
  children,
  className,
}: {
  url: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const kind = viewableFileKind(url);
  if (kind === "pdf") {
    return (
      <PdfViewerButton url={url} title={title} className={className}>
        {children ?? "View PDF"}
      </PdfViewerButton>
    );
  }
  if (kind === "video") {
    return (
      <VideoViewerButton url={url} title={title} className={className}>
        {children ?? "Watch video"}
      </VideoViewerButton>
    );
  }
  if (kind === "image") {
    return (
      <ImageViewerButton url={url} title={title} className={className}>
        {children ?? "View image"}
      </ImageViewerButton>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[12px] font-bold text-ink transition-colors hover:border-line-strong hover:bg-surface-2",
        className,
      )}
    >
      <ExternalLink className="h-4 w-4" aria-hidden />
      Open file
    </a>
  );
}

function ImageViewerButton({
  url,
  title,
  children,
  className,
}: {
  url: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

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
        <Eye className="h-4 w-4" aria-hidden />
        {children}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/75 p-2 backdrop-blur-sm sm:p-5"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[18px] border border-white/20 bg-surface shadow-2xl"
              >
                <header className="flex min-h-14 items-center gap-3 border-b border-line px-4 sm:px-5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700">
                    <ImageIcon className="h-4 w-4" aria-hidden />
                  </span>
                  <h2 className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink sm:text-[16px]">
                    {title}
                  </h2>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open image separately"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-bold text-ink hover:bg-surface-2"
                  >
                    <span className="hidden sm:inline">Open separately</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close image viewer"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>
                <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-ink/95 p-3">
                  <img
                    src={url}
                    alt={title}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
