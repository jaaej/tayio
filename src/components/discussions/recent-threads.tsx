"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { MessagesSquare, Pencil, Search, Send, X } from "lucide-react";
import type { RecentThreadSummary } from "@/lib/discussions-queries";
import { createThread } from "@/app/_actions/discussions";
import { boardSegment } from "@/lib/discussions";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { AttachmentPicker } from "@/components/discussions/attachments";
import { ThreadCard } from "@/components/discussions/thread-card";
import { initialOf, type DiscussionRole } from "./role-tone";

const SEARCH_THRESHOLD = 5;

export type ComposerBoard = { segment: string; label: string };

/**
 * Cross-board activity feed for the discussions landing page: the newest
 * threads from every board the user can see, so "what's new?" is answered
 * without opening each board in turn. Search filters the loaded set client-side
 * - it is already in the payload, so there is nothing to wait for.
 */
export function RecentThreads({
  threads,
  hrefPrefix,
  boards,
  userFirstName,
  rolePrefix,
}: {
  threads: RecentThreadSummary[];
  hrefPrefix: string;
  /** Boards the user may post to - drives the composer's board picker. */
  boards: ComposerBoard[];
  userFirstName: string;
  rolePrefix: DiscussionRole;
}) {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.authorName.toLowerCase().includes(q) ||
        t.boardLabel.toLowerCase().includes(q),
    );
  }, [threads, query]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h3 className="m-0 text-[18px] font-bold tracking-[-0.01em] text-ink">
          Recent activity
        </h3>
        {!composing && boards.length > 0 && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-5 text-[13px] font-bold text-white shadow-[0_10px_24px_-14px_rgba(31,40,90,0.7)] transition-transform duration-150 hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            New thread
          </button>
        )}
      </div>

      {composing && (
        <NewThreadForm
          boards={boards}
          userFirstName={userFirstName}
          rolePrefix={rolePrefix}
          onCancel={() => setComposing(false)}
        />
      )}

      {threads.length >= SEARCH_THRESHOLD && (
        <label className="flex items-center gap-3 rounded-full bg-surface border border-line px-5 py-3 transition-colors focus-within:border-line-strong">
          <Search className="h-4 w-4 text-muted shrink-0" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, names or boards…"
            aria-label="Search recent threads"
            className="flex-1 bg-transparent border-0 outline-none text-[14px] placeholder:text-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted hover:text-ink transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      )}

      {threads.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-surface px-6 py-10 text-center space-y-3">
          <div className="mx-auto inline-flex items-center justify-center h-[56px] w-[56px] rounded-[18px] bg-surface-2 text-muted">
            <MessagesSquare className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="text-[16px] font-bold text-ink">No threads yet</div>
          <div className="text-[14px] text-ink-soft">
            Open a board above to start the first one.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-surface px-6 py-8 text-center text-[14px] text-ink-soft">
          No threads match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((thread) => (
            <li key={thread.id}>
              <ThreadCard
                thread={thread}
                href={`${hrefPrefix}/${boardSegment(thread.board)}/${thread.id}`}
                tokens={getAccentTokens(colorFamilyForSubject(thread.boardLabel))}
                boardLabel={thread.boardLabel}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Same fields as a board's own composer, plus the board picker it doesn't need.
 * Posting redirects into the chosen board, which is where the new thread lives.
 */
function NewThreadForm({
  boards,
  userFirstName,
  rolePrefix,
  onCancel,
}: {
  boards: ComposerBoard[];
  userFirstName: string;
  rolePrefix: DiscussionRole;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        fd.append("rolePrefix", rolePrefix);
        startTransition(() => {
          void createThread(fd);
        });
      }}
      className="rounded-[18px] bg-surface border border-line p-6 space-y-4 shadow-[0_18px_38px_-22px_rgba(31,40,90,0.20)]"
    >
      <div className="flex items-center gap-3">
        <div className="h-[36px] w-[36px] rounded-full grid place-items-center text-[13px] font-bold text-white shrink-0 bg-brand-600">
          {initialOf(userFirstName)}
        </div>
        <div className="flex-1 text-[10px] uppercase tracking-[0.18em] font-bold text-brand-700">
          New question
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted hover:text-ink transition-colors"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="recent-thread-board"
          className="block text-[12px] font-bold text-ink-soft"
        >
          Board
        </label>
        <select
          id="recent-thread-board"
          name="boardSegment"
          required
          defaultValue={boards[0]?.segment}
          className="h-11 w-full rounded-[14px] border border-line-field bg-surface px-3 text-[14px] text-ink focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        >
          {boards.map((board) => (
            <option key={board.segment} value={board.segment}>
              {board.label}
            </option>
          ))}
        </select>
      </div>

      <input
        name="title"
        required
        maxLength={140}
        placeholder="Title of your question"
        aria-label="Title of your question"
        className="w-full text-[18px] font-bold text-ink placeholder:text-muted placeholder:font-semibold bg-transparent border-0 outline-none tracking-[-0.01em]"
      />
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={4}
        placeholder="Add details - what you've tried, where you're stuck."
        aria-label="Question details"
        className="w-full rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[14px] leading-relaxed placeholder:text-muted focus:outline-none focus:bg-surface focus:border-line-strong transition-colors"
      />
      <AttachmentPicker accent="var(--brand-600)" />
      <div className="flex items-center gap-3 pt-2 border-t border-line">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-5 text-[13px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(31,40,90,0.5)] disabled:opacity-50 transition-transform hover:-translate-y-[1px] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {pending ? "Posting…" : "Post question"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-[13px] font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
