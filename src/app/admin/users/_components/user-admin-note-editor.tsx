"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, StickyNote, X } from "lucide-react";
import { setUserAdminNote } from "@/app/admin/_lib/actions-users";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function UserAdminNoteEditor({
  userId,
  initialNote,
  canEdit,
  compact = false,
}: {
  userId: string;
  initialNote: string | null;
  canEdit: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const normalizedInitial = initialNote?.trim() ?? "";
  const [saved, setSaved] = useState(normalizedInitial);
  const [value, setValue] = useState(normalizedInitial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = initialNote?.trim() ?? "";
    setSaved(next);
    setValue(next);
  }, [initialNote]);

  function beginEditing() {
    if (!canEdit) return;
    setValue(saved);
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setValue(saved);
    setError(null);
    setEditing(false);
  }

  async function save() {
    setError(null);
    const result = await setUserAdminNote({ id: userId, note: value });
    if (!result.ok) {
      setError(result.error);
      throw new Error(result.error);
    }

    setSaved(result.note);
    setValue(result.note);
    router.refresh();
    window.setTimeout(() => setEditing(false), 650);
  }

  if (!editing) {
    if (saved) {
      const content = (
        <>
          <span className="flex items-center gap-1.5 font-extrabold">
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            Internal admin note
            {canEdit && <Pencil className="ml-auto h-3 w-3" aria-hidden />}
          </span>
          <span className={cn("mt-1 block whitespace-pre-wrap", compact && "line-clamp-2")}>
            {saved}
          </span>
        </>
      );

      return canEdit ? (
        <button
          type="button"
          onClick={beginEditing}
          aria-label="Edit internal admin note"
          className={cn(
            "block w-full rounded-[9px] border border-warn/25 bg-warn-bg text-left text-[11px] font-medium leading-snug text-warn transition-colors hover:border-warn/45 hover:bg-warn-bg/80",
            compact ? "mt-2 max-w-[300px] px-2.5 py-2" : "px-4 py-3",
          )}
        >
          {content}
        </button>
      ) : (
        <div
          className={cn(
            "rounded-[9px] border border-warn/25 bg-warn-bg text-[11px] font-medium leading-snug text-warn",
            compact ? "mt-2 max-w-[300px] px-2.5 py-2" : "px-4 py-3",
          )}
        >
          {content}
        </div>
      );
    }

    if (!canEdit) {
      return compact ? null : (
        <p className="text-[13px] text-muted">No internal note has been added.</p>
      );
    }

    return (
      <button
        type="button"
        onClick={beginEditing}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[8px] border border-dashed border-line-strong font-bold text-muted transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
          compact ? "mt-2 px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-[12px]",
        )}
      >
        <StickyNote className="h-3.5 w-3.5" aria-hidden />
        Add internal note
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[10px] border border-warn/30 bg-warn-bg/55 p-3",
        compact ? "mt-2 w-[300px] max-w-full" : "w-full",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-warn">
          <StickyNote className="h-3.5 w-3.5" aria-hidden />
          Internal admin note
        </span>
        <button
          type="button"
          onClick={cancelEditing}
          aria-label="Close note editor"
          className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <Textarea
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={2000}
        placeholder="Private context for admins only"
        className={cn(
          "border-warn/25 bg-surface text-[13px]",
          compact ? "min-h-[92px] px-3 py-2" : "min-h-[120px]",
        )}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-muted">
          {value.length}/2000 · Not visible to this user
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelEditing}
            className="rounded-[8px] px-2.5 py-1.5 text-[11px] font-bold text-muted hover:bg-surface hover:text-ink"
          >
            Cancel
          </button>
          <LoadingButton
            onAction={save}
            size="sm"
            variant="brand"
            pendingLabel="Saving…"
            successLabel="Saved"
            errorLabel="Try again"
          >
            Save note
          </LoadingButton>
        </div>
      </div>
      {error && <p className="mt-2 text-[11px] font-semibold text-bad">{error}</p>}
    </div>
  );
}
