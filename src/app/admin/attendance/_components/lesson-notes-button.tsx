"use client";

import { useState, type ReactNode } from "react";
import { Button, SidePanel } from "@/components/admin/ui";

/**
 * Opens the tutor's notes for this lesson in a read-only side panel. The notes
 * are rendered on the server and passed in, so this only owns open/closed.
 */
export function LessonNotesButton({
  count,
  sub,
  children,
}: {
  count: number;
  sub: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-[11px] px-3.5"
        onClick={() => setOpen(true)}
      >
        View lesson notes
        {count > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-3 px-1.5 text-[11px] font-extrabold tabular-nums">
            {count}
          </span>
        )}
      </Button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Lesson notes"
        sub={sub}
        size="wide"
      >
        {children}
      </SidePanel>
    </>
  );
}
