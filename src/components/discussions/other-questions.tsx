"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type OtherQuestion = {
  id: string;
  title: string;
  authorName: string;
  /** Last activity, already worded on the server ("2h ago"). */
  when: string;
  replyCount: number;
  removed: boolean;
};

/** Questions listed before "All questions" links to the board. */
const SHOWN = 8;

/**
 * The board's questions beside a thread, the open one highlighted, so the
 * next one is one tap away. "Unanswered" narrows it to questions with no
 * reply yet; the header folds the list away.
 */
export function OtherQuestions({
  threads,
  currentId,
  boardHref,
}: {
  threads: OtherQuestion[];
  currentId: string;
  boardHref: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(true);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const unanswered = threads.filter((t) => !t.removed && t.replyCount === 0);
  const list = unansweredOnly ? unanswered : threads;

  return (
    <section aria-labelledby={`${listId}-heading`} className="glass rounded-[24px] p-1.5">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-1 pl-1.5 pr-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <h2 id={`${listId}-heading`} className="text-[16px] font-extrabold text-ink">
            Other questions
          </h2>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-ink-soft transition-transform duration-150 motion-reduce:transition-none",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
          <span className="sr-only">{open ? "Hide" : "Show"}</span>
        </button>
        {open && (
          <div role="group" aria-label="Show" className="flex rounded-[12px] border border-white/90 bg-white/60 p-[3px]">
            {[
              { on: !unansweredOnly, label: "All", count: null, pick: false },
              { on: unansweredOnly, label: "Unanswered", count: unanswered.length, pick: true },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={tab.on}
                onClick={() => setUnansweredOnly(tab.pick)}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-[9px] px-2.5 text-[12px] font-extrabold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  tab.on ? "bg-ink text-white" : "text-ink hover:bg-white",
                )}
              >
                {tab.label}
                {tab.count !== null && <span className="tabular-nums">{tab.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div id={listId} className="panel overflow-hidden p-1.5">
          {list.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-muted">
              {unansweredOnly ? "Every question has a reply." : "No questions on this board yet."}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {list.slice(0, SHOWN).map((t) => {
                const current = t.id === currentId;
                return (
                  <li key={t.id}>
                    <Link
                      href={`${boardHref}/${t.id}`}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex flex-col gap-1 rounded-[12px] px-3 py-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400",
                        current ? "bg-surface-2" : "hover:bg-surface-2",
                      )}
                    >
                      <span
                        className={cn(
                          "line-clamp-2 text-[13px] font-extrabold leading-snug",
                          t.removed ? "italic text-muted" : "text-ink",
                        )}
                      >
                        {t.title}
                      </span>
                      <span className="flex items-center gap-2 text-[12px] text-ink-soft">
                        <span className="min-w-0 truncate">
                          {t.authorName} · {t.when}
                        </span>
                        {!t.removed && (
                          <span
                            className={cn(
                              "ml-auto shrink-0 font-extrabold tabular-nums",
                              t.replyCount === 0 ? "text-warn" : "text-ink-soft",
                            )}
                          >
                            {t.replyCount === 0
                              ? "Unanswered"
                              : `${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"}`}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {list.length > SHOWN && (
            <Link
              href={boardHref}
              className="mt-1 flex min-h-10 items-center justify-center rounded-[10px] text-[13px] font-bold text-brand-600 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              All {list.length} questions
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
