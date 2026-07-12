"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquareText, Pencil, Search, Send, X } from "lucide-react";
import type { AccentTokens } from "@/lib/subject-colors";
import type { ThreadSummary } from "@/lib/discussions-queries";
import { createThread } from "@/app/_actions/discussions";
import { AttachmentPicker } from "@/components/discussions/attachments";
import { initialOf, relativeShort, roleColor } from "./role-tone";

export function BoardInteractive({
  threads,
  hrefPrefix,
  boardSegment,
  tokens,
  userFirstName,
}: {
  threads: ThreadSummary[];
  hrefPrefix: string;
  boardSegment: string;
  tokens: AccentTokens;
  userFirstName: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.authorName.toLowerCase().includes(q),
    );
  }, [threads, query]);

  return (
    <div className="space-y-5">
      <AskPrompt
        boardSegment={boardSegment}
        tokens={tokens}
        userFirstName={userFirstName}
      />

      {threads.length >= 5 && (
        <label className="flex items-center gap-3 rounded-full bg-surface border border-line px-5 py-3 transition-colors focus-within:border-line-strong">
          <Search className="h-4 w-4 text-muted shrink-0" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions or names…"
            aria-label="Search threads on this board"
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
        <div className="rounded-[20px] border border-line bg-surface px-6 py-12 text-center space-y-3">
          <div
            className="mx-auto inline-flex items-center justify-center h-[60px] w-[60px] rounded-[18px]"
            style={{ background: tokens.bgFrom, color: tokens.arrow }}
          >
            <Pencil className="h-7 w-7" strokeWidth={2} />
          </div>
          <div className="text-[17px] font-bold text-ink">
            No questions yet
          </div>
          <div className="text-[14px] text-ink-soft max-w-[320px] mx-auto">
            Be the first to ask — use the prompt above.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[20px] border border-line bg-surface px-6 py-8 text-center text-[14px] text-ink-soft">
          No threads match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((t) => (
            <li key={t.id}>
              <ThreadCard thread={t} hrefPrefix={hrefPrefix} tokens={tokens} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AskPrompt({
  boardSegment,
  tokens,
  userFirstName,
}: {
  boardSegment: string;
  tokens: AccentTokens;
  userFirstName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full flex items-center gap-4 rounded-[18px] bg-surface border border-line px-5 py-4 text-left transition-all duration-150 hover:border-line-strong hover:shadow-[0_18px_38px_-22px_rgba(31,40,90,0.25)]"
      >
        <div
          className="h-[40px] w-[40px] rounded-full grid place-items-center text-[14px] font-bold text-white shrink-0"
          style={{ background: tokens.arrow }}
        >
          {initialOf(userFirstName)}
        </div>
        <span className="flex-1 text-[14px] text-muted font-semibold">
          What&apos;s your question, {userFirstName}?
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(31,40,90,0.5)] shrink-0"
          style={{ background: tokens.arrow }}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Ask
        </span>
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(fd) => {
        fd.append("boardSegment", boardSegment);
        fd.append("rolePrefix", "student");
        startTransition(() => {
          void createThread(fd);
        });
      }}
      className="rounded-[18px] bg-surface border border-line p-6 space-y-4 shadow-[0_18px_38px_-22px_rgba(31,40,90,0.20)]"
    >
      <div className="flex items-center gap-3">
        <div
          className="h-[36px] w-[36px] rounded-full grid place-items-center text-[13px] font-bold text-white shrink-0"
          style={{ background: tokens.arrow }}
        >
          {initialOf(userFirstName)}
        </div>
        <div
          className="flex-1 text-[10px] uppercase tracking-[0.18em] font-bold"
          style={{ color: tokens.arrow }}
        >
          New question
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted hover:text-ink transition-colors"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        name="title"
        required
        maxLength={140}
        autoFocus
        placeholder="Title of your question"
        className="w-full text-[18px] font-bold text-ink placeholder:text-muted placeholder:font-semibold bg-transparent border-0 outline-none tracking-[-0.01em]"
      />
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={4}
        placeholder="Add details — what you've tried, where you're stuck."
        className="w-full rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[14px] leading-relaxed placeholder:text-muted focus:outline-none focus:bg-surface focus:border-line-strong transition-colors"
      />
      <AttachmentPicker accent={tokens.arrow} />
      <div className="flex items-center gap-3 pt-2 border-t border-line">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(31,40,90,0.5)] disabled:opacity-50 transition-transform hover:-translate-y-[1px]"
          style={{ background: tokens.arrow }}
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {pending ? "Posting…" : "Post question"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="text-[13px] font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ThreadCard({
  thread,
  hrefPrefix,
  tokens,
}: {
  thread: ThreadSummary;
  hrefPrefix: string;
  tokens: AccentTokens;
}) {
  const deleted = thread.deletedAt !== null;
  const title = deleted ? "[removed by admin]" : thread.title;
  const activity = relativeShort(thread.lastActivityAt);
  const hasReplies = thread.replyCount > 0;
  const avatarColor = roleColor(thread.authorRole);

  return (
    <Link
      href={`${hrefPrefix}/${thread.id}`}
      className="group block bg-surface border border-line rounded-[20px] px-6 py-5 transition-all duration-150 hover:-translate-y-[2px] hover:border-line-strong hover:shadow-[0_18px_38px_-22px_rgba(31,40,90,0.30)]"
    >
      <div className="flex items-start gap-4">
        <div
          className="h-[44px] w-[44px] rounded-full grid place-items-center text-[15px] font-bold text-white shrink-0"
          style={{ background: avatarColor }}
        >
          {initialOf(thread.authorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold text-ink leading-snug tracking-[-0.01em] line-clamp-2">
            {title}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px] flex-wrap">
            <span className="font-bold text-ink-soft truncate">
              {thread.authorName}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ background: tokens.pillBg, color: tokens.pillText }}
            >
              {thread.authorRole}
            </span>
            <span className="text-muted font-semibold">·</span>
            <span className="text-muted font-semibold tabular-nums">
              {activity}
            </span>
          </div>
        </div>
        <div
          className="hidden sm:flex flex-col items-center justify-center min-w-[68px] rounded-[14px] px-3 py-2.5 shrink-0"
          style={{
            background: hasReplies ? tokens.bgFrom : "var(--surface-2)",
            color: hasReplies ? tokens.arrow : "var(--muted)",
          }}
        >
          <div className="text-[22px] font-bold tabular-nums leading-none tracking-[-0.02em]">
            {thread.replyCount}
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] font-bold">
            {thread.replyCount === 1 ? "reply" : "replies"}
          </div>
        </div>
      </div>
    </Link>
  );
}
