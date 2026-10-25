"use client";

import { useState, type ReactNode } from "react";
import { Download, ExternalLink, Eye, File as FileIcon, ImageIcon } from "lucide-react";
import { viewableFileKind, type ViewableFileKind } from "@/lib/file-viewer";
import { cn } from "@/lib/utils";
import { PdfViewerButton, PdfViewerDialog } from "@/components/ui/pdf-viewer";
import { VideoViewerButton, VideoViewerDialog } from "@/components/ui/video-viewer";
import { ViewerDialog } from "@/components/ui/viewer-dialog";

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

/**
 * The viewer for one file, whatever its kind: PDF, image and video preview
 * in the portal; anything else (Word, PowerPoint, Excel) shows what it is
 * and offers Download. Every kind has Download when `downloadUrl` is given.
 */
export function FileViewerDialog({
  open,
  url,
  downloadUrl,
  kind,
  format,
  title,
  onClose,
}: {
  open: boolean;
  url: string | null;
  downloadUrl: string | null;
  kind: ViewableFileKind;
  /** "DOCX", for the no-preview card. */
  format?: string | null;
  title: string;
  onClose: () => void;
}) {
  if (kind === "pdf") {
    return <PdfViewerDialog open={open} url={url} downloadUrl={downloadUrl} title={title} onClose={onClose} />;
  }
  if (kind === "video") {
    return <VideoViewerDialog open={open} url={url} downloadUrl={downloadUrl} title={title} onClose={onClose} />;
  }
  if (kind === "image") {
    return <ImageViewerDialog open={open} url={url} downloadUrl={downloadUrl} title={title} onClose={onClose} />;
  }
  return (
    <ViewerDialog open={open} title={title} icon={FileIcon} noun="file" onClose={onClose} fitContent>
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-[14px] bg-surface-3 text-ink-soft">
          <FileIcon className="h-6 w-6" aria-hidden />
        </span>
        <p className="max-w-[360px] text-[14px] text-ink-soft">
          {format ? `${format} files` : "Files like this"} can&apos;t be previewed in the portal.
        </p>
        {downloadUrl && (
          <a
            href={downloadUrl}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-bold text-white transition-[filter] hover:brightness-110"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </a>
        )}
      </div>
    </ViewerDialog>
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
      <ImageViewerDialog open={open} url={url} title={title} onClose={() => setOpen(false)} />
    </>
  );
}

function ImageViewerDialog({
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
  return (
    <ViewerDialog
      open={open}
      title={title}
      icon={ImageIcon}
      noun="image"
      url={url}
      downloadUrl={downloadUrl}
      onClose={onClose}
    >
      <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-ink/95 p-3">
        {/* A short-lived signed URL to a private file; the next/image
            cache would store it beyond its expiry. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} className="max-h-full max-w-full object-contain" />
      </div>
    </ViewerDialog>
  );
}
