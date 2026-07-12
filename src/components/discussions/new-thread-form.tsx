"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { createThread } from "@/app/_actions/discussions";
import { AttachmentPicker } from "@/components/discussions/attachments";

export function NewThreadForm({
  boardSegment,
  rolePrefix,
}: {
  boardSegment: string;
  rolePrefix: "student" | "tutor" | "admin";
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Card>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full text-left text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          + Ask a question
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <form
        action={(fd) => {
          fd.append("boardSegment", boardSegment);
          fd.append("rolePrefix", rolePrefix);
          startTransition(() => {
            void createThread(fd);
          });
        }}
        className="space-y-3"
      >
        <input
          name="title"
          required
          maxLength={140}
          placeholder="Title (e.g. Question about Q5 in chapter 3)"
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand-600"
        />
        <textarea
          name="body"
          required
          maxLength={4000}
          rows={4}
          placeholder="Add details — what you've tried, where you're stuck."
          className="w-full rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand-600"
        />
        <AttachmentPicker />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Posting…" : "Post"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="text-sm text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
