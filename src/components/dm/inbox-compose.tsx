"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowLeft, Building2 } from "lucide-react";
import { ThreadRow } from "@/components/dm/thread-row";
import type { ThreadInboxRow } from "@/lib/dm-queries";

export type DmContact = {
  id: string;
  name: string;
  meta?: string;
  /** Renders a building icon instead of an initial (e.g. the admin office). */
  office?: boolean;
};
export type DmGroup = { label: string; contacts: DmContact[] };

/**
 * Shared messaging inbox used by every role. Default view is the conversation
 * list (the same ThreadRow used across the portal); a single "New message"
 * action reveals a categorized contact picker to start a new thread. One entry
 * point, no redundant stacked blocks. An empty inbox opens into the picker.
 */
export function InboxCompose({
  threads,
  hrefPrefix,
  groups,
}: {
  threads: ThreadInboxRow[];
  hrefPrefix: string;
  groups: DmGroup[];
}) {
  const visibleGroups = groups.filter((g) => g.contacts.length > 0);
  const [composing, setComposing] = useState(threads.length === 0);

  if (composing) {
    return (
      <div className="space-y-4">
        {threads.length > 0 && (
          <button
            type="button"
            onClick={() => setComposing(false)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700 transition-colors hover:text-brand-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to inbox
          </button>
        )}
        <div className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          New message
        </div>
        {visibleGroups.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-surface px-4 py-6 text-[13px] text-muted">
            No one to message yet.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((g) => (
              <div key={g.label} className="space-y-1.5">
                <div className="px-1 text-[12px] font-bold text-ink-soft">
                  {g.label}
                </div>
                <div className="max-h-80 divide-y divide-line overflow-y-auto rounded-[14px] border border-line bg-surface">
                  {g.contacts.map((c) => (
                    <Link
                      key={c.id}
                      href={`${hrefPrefix}/with/${c.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-[12px] font-extrabold text-brand-ink">
                        {c.office ? (
                          <Building2 className="h-[18px] w-[18px]" />
                        ) : (
                          c.name.charAt(0).toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-ink">
                          {c.name}
                        </span>
                        {c.meta && (
                          <span className="block truncate text-[12px] text-muted">
                            {c.meta}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[12px] font-bold text-brand-700">
                        Message →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New message
        </button>
      </div>
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
        <ul className="divide-y divide-line">
          {threads.map((t) => (
            <li key={t.threadId}>
              <ThreadRow thread={t} hrefPrefix={hrefPrefix} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
