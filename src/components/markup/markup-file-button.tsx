"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon } from "lucide-react";
import type { MarkupTarget } from "@/lib/markup/targets";
import { cn } from "@/lib/utils";
import { MarkupViewer } from "./markup-viewer";

/**
 * Opens a PDF or picture in the writing viewer (`MarkupViewer`). Looks like
 * the portal's other file buttons; `submittedHref` is where a student lands
 * after "Submit this file".
 */
export function MarkupFileButton({
  target,
  title,
  fileKind,
  resubmit,
  submittedHref,
  onOpen,
  className,
  children,
}: {
  target: MarkupTarget;
  title: string;
  fileKind: "pdf" | "image";
  resubmit?: boolean;
  submittedHref?: string;
  /** Called as the file opens (a booklet records that it was opened). */
  onOpen?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const Icon = fileKind === "pdf" ? FileText : ImageIcon;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
        className={cn(
          "inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[12px] font-bold text-ink transition-colors hover:border-line-strong hover:bg-surface-2",
          className,
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {children}
      </button>
      {open && (
        <MarkupViewer
          target={target}
          title={title}
          fileKind={fileKind}
          resubmit={resubmit}
          onClose={() => setOpen(false)}
          onSubmitted={() => {
            setOpen(false);
            // One navigation only: a refresh fired straight after the replace
            // aborted it, and the student never saw the work had gone in.
            const here = window.location.pathname + window.location.search;
            if (submittedHref && submittedHref !== here) router.replace(submittedHref, { scroll: false });
            else router.refresh();
          }}
        />
      )}
    </>
  );
}
