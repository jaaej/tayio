"use client";

import { useState, useTransition } from "react";
import { PdfViewerDialog } from "@/components/ui/pdf-viewer";
import { markBookletOpened } from "../_actions";

/**
 * Opens the week booklet in the PDF viewer and records that the student
 * opened it. The signed URL is fetched on the first click, so the booklet
 * only counts as opened when the student actually opens it.
 */
export function BookletLink({
  subjectWeekId,
  className,
  style,
  children,
}: {
  subjectWeekId: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={() => {
          if (url) {
            setOpen(true);
            return;
          }
          startTransition(async () => {
            const res = await markBookletOpened(subjectWeekId);
            if (res.ok) {
              setUrl(res.url);
              setOpen(true);
            } else alert(res.error);
          });
        }}
        className={className}
        style={style}
      >
        {children}
      </button>
      <PdfViewerDialog
        open={open}
        url={url}
        title="Week booklet"
        onClose={() => setOpen(false)}
      />
    </>
  );
}
