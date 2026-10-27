"use client";

import { useState } from "react";
import { MarkupViewer } from "@/components/markup/markup-viewer";
import { markBookletOpened } from "../_actions";

/**
 * Opens the week booklet in the writing viewer, where the student can take
 * notes on it, and records that they opened it.
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
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void markBookletOpened(subjectWeekId);
        }}
        className={className}
        style={style}
      >
        {children}
      </button>
      {open && (
        <MarkupViewer
          target={{ kind: "booklet", subjectWeekId }}
          title="Week booklet"
          fileKind="pdf"
          onClose={() => setOpen(false)}
          onSubmitted={() => setOpen(false)}
        />
      )}
    </>
  );
}
