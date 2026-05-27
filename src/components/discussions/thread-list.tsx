"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThreadRow } from "@/components/discussions/thread-row";
import type { ThreadSummary } from "@/lib/discussions-queries";

export function ThreadList({
  threads,
  hrefPrefix,
}: {
  threads: ThreadSummary[];
  hrefPrefix: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const titleMatch = t.title.toLowerCase().includes(q);
      const authorMatch = t.authorName.toLowerCase().includes(q);
      return titleMatch || authorMatch;
    });
  }, [threads, query]);

  if (threads.length === 0) {
    return (
      <Card>
        <div className="py-6 text-sm text-ink-soft">
          No questions yet. Be the first to ask.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-hairline/60 bg-card px-3 py-2 focus-within:border-brand-600 transition-colors">
        <Search className="h-4 w-4 text-muted shrink-0" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions or names…"
          aria-label="Search threads on this board"
          className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted"
        />
      </label>

      {filtered.length === 0 ? (
        <Card>
          <div className="py-6 text-sm text-ink-soft">
            No threads match “{query}”. Try a different keyword.
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-hairline/60">
            {filtered.map((t) => (
              <li key={t.id}>
                <ThreadRow thread={t} hrefPrefix={hrefPrefix} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
