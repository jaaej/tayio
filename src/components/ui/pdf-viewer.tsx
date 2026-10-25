"use client";

import { useState, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { ViewerDialog } from "@/components/ui/viewer-dialog";
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
      icon={FileText}
      noun="PDF"
      url={url}
      downloadUrl={downloadUrl}
      onClose={onClose}
    >
      <iframe
        src={`${url}#toolbar=1&navpanes=0`}
        title={title}
        className="min-h-0 flex-1 bg-surface-2"
      />
      <div className="border-t border-line px-4 py-2 text-center text-[11px] text-muted sm:hidden">
        If the preview does not load, use the external-link button above.
      </div>
    </ViewerDialog>
  );
}
