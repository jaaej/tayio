"use client";

import { useEffect, useState } from "react";

export type FeedbackItem = {
  id: string;
  subjectName: string | null;
  tutorName: string;
  parentVisibleComment: string;
  timeLabel: string;
};

const STORAGE_KEY = "tayio:parent:feedback-read";

function loadRead(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function persistRead(read: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...read]));
  } catch {
    // ignore storage errors (e.g., quota, private mode)
  }
}

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRead(loadRead());
    setHydrated(true);
  }, []);

  function toggle(id: string) {
    setRead((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistRead(next);
      return next;
    });
  }

  const unreadCount = hydrated
    ? items.filter((f) => !read.has(f.id)).length
    : 0;

  function markAllRead() {
    setRead((prev) => {
      const next = new Set(prev);
      for (const f of items) next.add(f.id);
      persistRead(next);
      return next;
    });
  }

  return (
    <div>
      {hydrated && unreadCount > 0 && (
        <div className="flex items-center justify-end gap-2 px-6 pt-3">
          <button
            type="button"
            onClick={markAllRead}
            className="text-[11px] uppercase tracking-[0.14em] font-bold text-brand-700 hover:underline"
          >
            Mark all read
          </button>
        </div>
      )}
      <div className="divide-y divide-line/70">
        {items.map((f) => {
          const isRead = hydrated && read.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => toggle(f.id)}
              aria-pressed={isRead}
              className={`flex w-full items-start gap-3 text-left px-5 py-4 transition-colors ${
                isRead ? "bg-transparent" : "bg-brand-50/50"
              } hover:bg-surface-2/70`}
            >
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 mt-0.5 bg-brand-50 text-brand-700"
              >
                {f.subjectName ?? "Lesson"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-bold text-ink truncate">
                    {f.tutorName}
                  </span>
                  <span className="text-[11px] text-muted shrink-0">
                    {f.timeLabel}
                  </span>
                </div>
                <p
                  className={`mt-1 text-sm leading-relaxed line-clamp-2 ${
                    isRead ? "text-ink-soft/70" : "text-ink-soft"
                  }`}
                >
                  {f.parentVisibleComment}
                </p>
              </div>
              {!isRead && (
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full bg-brand-500 shrink-0 mt-1.5"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
