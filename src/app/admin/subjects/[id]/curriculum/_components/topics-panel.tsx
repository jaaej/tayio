"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import {
  createSubjectTopic,
  renameSubjectTopic,
  reorderSubjectTopic,
  deleteSubjectTopic,
} from "@/app/admin/_lib/actions-topics";

type Topic = { id: string; name: string; position: number };

export function TopicsPanel({
  subjectId,
  topics,
  weekCounts,
}: {
  subjectId: string;
  topics: Topic[];
  weekCounts: Record<string, number>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else setEditingId(null);
    });
  }

  return (
    <div className="rounded-[14px] border border-line bg-surface p-4 space-y-3">
      <div className="text-[14px] font-bold text-ink">Topics</div>

      {topics.length === 0 ? (
        <div className="text-[13px] text-ink-soft">
          No topics yet. Add one below, then assign weeks to it.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {topics.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2">
              {editingId === t.id ? (
                <form
                  action={(fd) => run(() => renameSubjectTopic(t.id, subjectId, fd))}
                  className="flex-1 flex items-center gap-2"
                >
                  <input
                    name="name"
                    defaultValue={t.name}
                    className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-ink"
                    required
                    autoFocus
                  />
                  <Button type="submit" disabled={pending}>Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-[14px] text-ink">{t.name}</span>
                  <button
                    type="button"
                    disabled={pending || i === 0}
                    onClick={() => run(() => reorderSubjectTopic(t.id, subjectId, "up"))}
                    className="px-2 py-1 text-ink-soft disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pending || i === topics.length - 1}
                    onClick={() => run(() => reorderSubjectTopic(t.id, subjectId, "down"))}
                    className="px-2 py-1 text-ink-soft disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(t.id)}>
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending}
                    onClick={() => {
                      const n = weekCounts[t.id] ?? 0;
                      const msg =
                        n > 0
                          ? `Delete "${t.name}"? ${n} week${n === 1 ? "" : "s"} will become unassigned.`
                          : `Delete "${t.name}"?`;
                      if (confirm(msg)) run(() => deleteSubjectTopic(t.id, subjectId));
                    }}
                  >
                    Delete
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        action={(fd) => {
          fd.set("subjectId", subjectId);
          run(() => createSubjectTopic(fd));
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          name="name"
          placeholder="New topic name"
          className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-ink"
          required
        />
        <Button type="submit" disabled={pending}>Add topic</Button>
      </form>

      {error && <div className="text-[13px] font-semibold text-bad">{error}</div>}
    </div>
  );
}
