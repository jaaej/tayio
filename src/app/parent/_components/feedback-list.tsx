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
            className="text-[11px] uppercase tracking-[0.14em] text-brand-700 hover:underline"
          >
            Mark all read
          </button>
        </div>
      )}
      <div className="divide-y divide-hairline/60">
        {items.map((f) => {
          const isRead = hydrated && read.has(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => toggle(f.id)}
              aria-pressed={isRead}
              className={`block w-full text-left px-6 py-5 transition-colors ${
                isRead
                  ? "bg-transparent"
                  : "bg-gradient-to-r from-brand-50/40 via-brand-50/10 to-transparent"
              } hover:bg-brand-50/30`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted">
                    <span
                      aria-hidden
                      className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                        isRead ? "bg-hairline" : "bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100/60"
                      }`}
                    />
                    <span className="truncate">
                      {f.subjectName ?? "Lesson"} · {f.tutorName}
                    </span>
                  </div>
                  <p
                    className={`mt-1.5 text-base leading-relaxed line-clamp-2 ${
                      isRead ? "text-ink-soft/70" : "text-ink-soft"
                    }`}
                  >
                    {f.parentVisibleComment}
                  </p>
                </div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted shrink-0">
                  {f.timeLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
