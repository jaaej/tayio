"use client";

import { useState, useTransition } from "react";
import { Plus, Send } from "lucide-react";
import { createThread } from "@/app/_actions/discussions";
import { Button } from "@/components/admin/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { ActionButtonLabel } from "@/components/ui/loading-button";
import { AttachmentPicker } from "./attachments";
import type { DiscussionRole } from "./role-tone";

export type ComposerBoard = { segment: string; label: string };

const FIELD =
  "w-full rounded-[12px] border border-line-field bg-surface px-3.5 text-[14px] text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10";

/**
 * The one "New thread" entry point for every role: a header button that opens
 * the composer in a side panel. On the landing page it carries a board picker;
 * on a board page the board is fixed. Posting redirects into the new thread.
 */
export function NewThreadButton({
  boards,
  rolePrefix,
}: {
  /** One board fixes the destination; several show a picker. */
  boards: ComposerBoard[];
  rolePrefix: DiscussionRole;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formId = "new-thread-form";
  if (boards.length === 0) return null;
  const fixedBoard = boards.length === 1 ? boards[0] : null;

  return (
    <>
      <Button type="button" size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
        New thread
      </Button>
      <SidePanel
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="New thread"
        sub={fixedBoard ? fixedBoard.label : undefined}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={pending}>
              <ActionButtonLabel pending={pending} pendingLabel="Posting…">
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  Post question
                </>
              </ActionButtonLabel>
            </Button>
          </>
        }
      >
        <form
          id={formId}
          action={(fd) => {
            fd.append("rolePrefix", rolePrefix);
            if (fixedBoard) fd.set("boardSegment", fixedBoard.segment);
            startTransition(() => {
              void createThread(fd);
            });
          }}
          className="flex flex-col gap-4"
        >
          {!fixedBoard && (
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
              Board
              <select
                name="boardSegment"
                required
                defaultValue={boards[0]?.segment}
                className={`${FIELD} h-11`}
              >
                {boards.map((board) => (
                  <option key={board.segment} value={board.segment}>
                    {board.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Title
            <input
              name="title"
              required
              maxLength={140}
              placeholder="Title of your question"
              className={`${FIELD} h-11 font-semibold`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
            Details
            <textarea
              name="body"
              required
              maxLength={4000}
              rows={6}
              placeholder="Add details - what you've tried, where you're stuck."
              className={`${FIELD} resize-y py-3 font-medium leading-relaxed`}
            />
          </label>
          <AttachmentPicker accent="var(--ink)" />
        </form>
      </SidePanel>
    </>
  );
}
