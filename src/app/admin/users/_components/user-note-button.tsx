"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { SidePanel } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { UserAdminNoteEditor } from "./user-admin-note-editor";

/**
 * The directory row's internal-note control. A row with a note shows a tinted
 * icon with a dot, and hovering previews the note; clicking opens the shared
 * note editor in a side panel, so the table stays one line per person.
 */
export function UserNoteButton({
  userId,
  name,
  note,
  canEdit,
}: {
  userId: string;
  name: string;
  note: string | null;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasNote = Boolean(note?.trim());
  if (!hasNote && !canEdit) return <span className="h-9 w-9" aria-hidden />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          hasNote ? `Internal note for ${name}` : `Add internal note for ${name}`
        }
        title={hasNote ? note!.trim() : "Add internal note"}
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
          hasNote
            ? "bg-warn-bg text-warn hover:bg-warn-bg/70"
            : "text-muted hover:bg-surface-2 hover:text-ink",
        )}
      >
        <FileText className="h-[18px] w-[18px]" aria-hidden />
        {hasNote && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warn"
          />
        )}
      </button>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Internal note"
        sub={name}
      >
        <UserAdminNoteEditor
          userId={userId}
          initialNote={note}
          canEdit={canEdit}
          autoEdit={!hasNote}
          inPanel
        />
      </SidePanel>
    </>
  );
}
