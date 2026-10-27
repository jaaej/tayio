"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const HEADER_ACTION =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-bold text-ink hover:bg-surface-2";

/**
 * The frame every in-portal viewer shares (PDF, image, video, other files):
 * a full-screen sheet on phones, a card up to 94vh on larger screens, closed
 * by Escape, the backdrop or the close button. `downloadUrl` adds Download;
 * `url` adds "Open separately"; `actions` go before them (the writing
 * viewer's Save).
 */
export function ViewerDialog({
  open,
  title,
  icon: Icon,
  noun,
  url,
  downloadUrl,
  actions,
  onClose,
  fitContent = false,
  children,
}: {
  open: boolean;
  title: string;
  icon: LucideIcon;
  /** "PDF", "image", "video", "file": names the header buttons for screen readers. */
  noun: string;
  url?: string | null;
  downloadUrl?: string | null;
  actions?: ReactNode;
  onClose: () => void;
  /** Size to the content (a 16:9 player, a details card) instead of 94vh. */
  fitContent?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

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
        className={cn(
          "flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-surface shadow-2xl sm:rounded-[18px] sm:border sm:border-white/20",
          fitContent ? "sm:h-auto" : "sm:h-[94vh]",
        )}
      >
        <header className="flex min-h-14 items-center gap-2 border-b border-line px-4 sm:gap-3 sm:px-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-ink sm:text-[16px]">
            {title}
          </h2>
          {actions}
          {downloadUrl && (
            <a href={downloadUrl} aria-label={`Download ${noun}`} className={HEADER_ACTION}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${noun} separately`}
              className={HEADER_ACTION}
            >
              <span className="hidden sm:inline">Open separately</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${noun} viewer`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
