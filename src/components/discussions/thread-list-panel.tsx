"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { ThreadSummary } from "@/lib/discussions-queries";
import { ThreadRow } from "./thread-row";

const SEARCH_THRESHOLD = 5;

type ListThread = ThreadSummary & {
  href: string;
  boardLabel?: string;
  boardColor?: string | null;
};

/**
 * A glass bezel holding a searchable list of thread rows. Used for the
 * landing page's cross-board "Recent activity" and for a single board's
 * thread list, so both read the same in every role. Search filters the
 * loaded set client-side - it is already in the payload.
 */
export function ThreadListPanel({
  title,
  threads,
  searchLabel,
  searchPlaceholder,
  empty,
  className,
}: {
  title: string;
  threads: ListThread[];
  searchLabel: string;
  searchPlaceholder: string;
  empty: { title: string; hint: string };
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const headingId = `${title.toLowerCase().replace(/\s+/g, "-")}-heading`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.authorName.toLowerCase().includes(q) ||
        (t.boardLabel?.toLowerCase().includes(q) ?? false),
    );
  }, [threads, query]);

  return (
    <section
      aria-labelledby={headingId}
      className={`glass flex min-w-0 flex-col rounded-[24px] p-1.5 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-2 px-3 pb-2.5 pt-2">
        <h2 id={headingId} className="text-[16px] font-extrabold text-ink">
          {title}
        </h2>
        {threads.length >= SEARCH_THRESHOLD && (
          <ThreadSearch
            value={query}
            onChange={setQuery}
            label={searchLabel}
            placeholder={searchPlaceholder}
          />
        )}
      </div>
      <div className="panel min-w-0 overflow-hidden">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
            <span className="text-[15px] font-bold text-ink">{empty.title}</span>
            <span className="text-[13px] text-muted">{empty.hint}</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-[13px] text-muted">
            No threads match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((thread) => (
              <li key={thread.id}>
                <ThreadRow
                  thread={thread}
                  href={thread.href}
                  boardLabel={thread.boardLabel}
                  boardColor={thread.boardColor}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ThreadSearch({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="flex h-[38px] items-center gap-2 rounded-[11px] bg-surface px-3 text-muted focus-within:ring-2 focus-within:ring-brand-400">
      <Search className="h-[15px] w-[15px] shrink-0" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="-mr-1.5 grid h-8 w-8 place-items-center rounded-[8px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </label>
  );
}
