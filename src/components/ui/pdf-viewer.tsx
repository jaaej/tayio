"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function PdfViewerButton({
  url,
  title,
  children = "View PDF",
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
        <FileText className="h-4 w-4" aria-hidden />
        {children}
      </button>
      <PdfViewerDialog
        open={open}
        url={url}
        title={title}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function PdfViewerDialog({
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

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/70 p-2 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink sm:text-[16px]">
            {title}
          </h2>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open PDF separately"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-bold text-ink hover:bg-surface-2"
          >
            <span className="hidden sm:inline">Open separately</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close PDF viewer"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <iframe
          src={`${url}#toolbar=1&navpanes=0`}
          title={title}
          className="min-h-0 flex-1 bg-surface-2"
        />
        <div className="border-t border-line px-4 py-2 text-center text-[11px] text-muted sm:hidden">
          If the preview does not load, use the external-link button above.
        </div>
      </section>
    </div>,
    document.body,
  );
}
