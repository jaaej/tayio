"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, StickyNote } from "lucide-react";
import { setUserAdminNote } from "@/app/admin/_lib/actions-users";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";

/** Amber "admins only" note block on a user's profile; click to edit. */
export function UserAdminNoteEditor({
  userId,
  initialNote,
  canEdit,
}: {
  userId: string;
  initialNote: string | null;
  canEdit: boolean;
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

  // A different person was selected: drop any half-written edit.
  useEffect(() => {
    setEditing(false);
    setError(null);
  }, [userId]);

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
      const text = (
        <span className="block whitespace-pre-wrap">{saved}</span>
      );
      return canEdit ? (
        <button
          type="button"
          onClick={beginEditing}
          aria-label="Edit internal note"
          className="group relative block w-full rounded-[12px] bg-[#FFF8EC] p-3 pr-10 text-left text-[13px] leading-[1.5] text-ink transition-colors hover:bg-warn-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {text}
          <Pencil
            className="absolute right-3 top-3 h-3.5 w-3.5 text-warn opacity-60 transition-opacity group-hover:opacity-100"
            aria-hidden
          />
        </button>
      ) : (
        <div className="rounded-[12px] bg-[#FFF8EC] p-3 text-[13px] leading-[1.5] text-ink">
          {text}
        </div>
      );
    }

    if (!canEdit) {
      return <p className="text-[13px] text-muted">No internal note.</p>;
    }

    return (
      <button
        type="button"
        onClick={beginEditing}
        className="flex w-fit items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-dashed border-line-strong px-3 py-2 text-[12px] font-bold text-muted transition-colors hover:border-warn/40 hover:bg-[#FFF8EC] hover:text-warn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <StickyNote className="h-3.5 w-3.5" aria-hidden />
        Add internal note
      </button>
    );
  }

  return (
    <div className="rounded-[12px] bg-[#FFF8EC] p-3">
      <Textarea
        autoFocus
        aria-label="Internal note"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={2000}
        placeholder="Private context for admins only"
        className="min-h-[120px] border-warn/25 bg-surface text-[13px]"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tabular-nums text-muted">
          {value.length}/2000
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelEditing}
            className="min-h-[30px] rounded-[9px] px-2.5 text-[12px] font-bold text-muted hover:bg-surface hover:text-ink"
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
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
