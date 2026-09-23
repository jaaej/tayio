"use client";

import { useState, useTransition } from "react";
import { PdfViewerDialog } from "@/components/ui/pdf-viewer";
import { markBookletOpened } from "../_actions";

export function BookletLink({
  subjectWeekId,
  alreadyOpened,
}: {
  subjectWeekId: string;
  alreadyOpened: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={pending}
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
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-4 py-2 text-sm font-medium hover:bg-brand-50"
      >
        {pending
          ? "Opening…"
          : alreadyOpened
            ? "View PDF (opened earlier)"
            : "View PDF →"}
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
