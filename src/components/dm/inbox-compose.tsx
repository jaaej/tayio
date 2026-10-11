"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
import { buttonVariants } from "@/components/admin/ui/button";
import { ThreadRow } from "@/components/dm/thread-row";
import type { ThreadInboxRow } from "@/lib/dm-queries";
import { cn } from "@/lib/utils";
import { initialsOf } from "./dm-visuals";

export type DmContact = {
  id: string;
  name: string;
  meta?: string;
  /** Renders a building icon instead of initials (e.g. the admin office). */
  office?: boolean;
};
export type DmGroup = { label: string; contacts: DmContact[] };

function matches(name: string, query: string) {
  return name.toLowerCase().includes(query);
}

/**
 * Left pane of the shared messaging workspace, used by every role: the
 * conversation list, a people search, and one "New" action that swaps the
 * list for a categorized contact picker. An empty inbox opens into the picker.
 */
export function InboxCompose({
  threads,
  hrefPrefix,
  groups,
  activeThreadId,
  className,
}: {
  threads: ThreadInboxRow[];
  hrefPrefix: string;
  groups: DmGroup[];
  activeThreadId?: string;
  className?: string;
}) {
  const [composing, setComposing] = useState(threads.length === 0);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const visibleThreads = q
    ? threads.filter((t) => matches(t.otherName, q))
    : threads;
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      contacts: q ? g.contacts.filter((c) => matches(c.name, q)) : g.contacts,
    }))
    .filter((g) => g.contacts.length > 0);
  const hasContacts = groups.some((g) => g.contacts.length > 0);

  return (
    <section
      aria-labelledby="messages-inbox-title"
      className={cn(
        "glass min-w-0 flex-col rounded-[24px] p-1.5 lg:min-h-0",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 pb-2.5 pl-3 pr-2 pt-2">
        <div className="flex min-h-9 items-center justify-between gap-2">
          <h1
            id="messages-inbox-title"
            className="text-[20px] font-extrabold leading-tight text-ink"
          >
            {composing ? "New message" : "Messages"}
          </h1>
          {composing ? (
            threads.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setComposing(false);
                  setQuery("");
                }}
                className={buttonVariants({ variant: "glass", size: "md" })}
              >
                Cancel
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
                setComposing(true);
                setQuery("");
              }}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
              New
            </button>
          )}
        </div>
        <label className="flex h-[38px] items-center gap-2 rounded-[11px] bg-white px-3 text-muted focus-within:ring-2 focus-within:ring-brand-400">
          <Search className="h-[15px] w-[15px] shrink-0" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label={composing ? "Search people to message" : "Search conversations"}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
          />
        </label>
      </div>

      <div className="panel min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {composing ? (
          !hasContacts ? (
            <PaneMessage>No one to message yet.</PaneMessage>
          ) : visibleGroups.length === 0 ? (
            <PaneMessage>No one matches that name.</PaneMessage>
          ) : (
            visibleGroups.map((g) => (
              <div key={g.label} className="pb-1">
                <h2 className="px-2.5 pb-1 pt-2.5 text-[12px] font-bold text-muted">
                  {g.label}
                </h2>
                <ul className="flex flex-col gap-0.5">
                  {g.contacts.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`${hrefPrefix}/with/${c.id}`}
                        className="flex items-center gap-2.5 rounded-[12px] p-2.5 text-ink transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                      >
                        <span
                          aria-hidden
                          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-surface-3 text-[12px] font-extrabold text-ink"
                        >
                          {c.office ? (
                            <Building2 className="h-[17px] w-[17px]" />
                          ) : (
                            initialsOf(c.name)
                          )}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[14px] font-bold">
                            {c.name}
                          </span>
                          {c.meta && (
                            <span className="truncate text-[12px] text-muted">
                              {c.meta}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )
        ) : visibleThreads.length === 0 ? (
          <PaneMessage>No conversations match that name.</PaneMessage>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visibleThreads.map((t) => (
              <li key={t.threadId}>
                <ThreadRow
                  thread={t}
                  hrefPrefix={hrefPrefix}
                  active={t.threadId === activeThreadId}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PaneMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-8 text-center text-[13px] font-medium text-muted">
      {children}
    </p>
  );
}
