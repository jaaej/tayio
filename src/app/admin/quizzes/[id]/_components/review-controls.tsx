"use client";

import { useId, useState, useTransition } from "react";
import { Button, SidePanel } from "@/components/admin/ui";
import { requestChanges } from "@/app/_actions/quizzes";

/**
 * Secondary admin review action, shown in the quiz header beside Approve.
 * Sending a quiz back always needs a note for the tutor, so the button opens a
 * side panel to write it rather than acting straight away.
 */
export function ReviewControls({ quizId }: { quizId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const formId = useId();
  const noteId = `${formId}-note`;

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function sendBack() {
    setError(null);
    if (note.trim().length === 0) {
      setError("Add a note explaining what needs to change.");
      return;
    }
    start(async () => {
      const res = await requestChanges({ quizId, note: note.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setNote("");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="glass"
        size="lg"
        onClick={() => setOpen(true)}
      >
        Send back for changes
      </Button>

      <SidePanel
        open={open}
        onClose={close}
        title="Send back for changes"
        footer={
          <>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              disabled={pending}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              size="lg"
              variant="danger"
              disabled={pending}
            >
              {pending ? "Sending…" : "Send back"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            sendBack();
          }}
          className="flex flex-col gap-1.5"
        >
          <label htmlFor={noteId} className="text-[13px] font-bold text-ink">
            What needs to change
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            maxLength={5000}
            disabled={pending}
            placeholder="e.g. Question 2 has two correct answers marked"
            className="w-full rounded-[12px] border border-line-strong bg-surface px-3.5 py-3 text-[14px] text-ink placeholder:text-muted transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 disabled:opacity-60"
          />
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-bad">
              {error}
            </p>
          )}
        </form>
      </SidePanel>
    </>
  );
}
