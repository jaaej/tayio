import Link from "next/link";
import type { ThreadSummary } from "@/lib/discussions-queries";

export function OtherQuestions({
  threads,
  hrefPrefix,
  boardLabel,
}: {
  threads: ThreadSummary[];
  hrefPrefix: string;
  boardLabel: string;
}) {
  if (threads.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-xs uppercase tracking-[0.2em] text-ink-soft font-medium">
          More from {boardLabel}
        </div>
        <div className="text-xs text-muted tabular-nums">{threads.length}</div>
      </div>
      <ul className="divide-y divide-hairline/60">
        {threads.map((t) => (
          <li key={t.id}>
            <Link
              href={`${hrefPrefix}/${t.id}`}
              className="block px-1 py-3 rounded-lg transition-colors hover:bg-brand-50/40"
            >
              <div className="text-sm font-medium text-ink line-clamp-1">
                {t.deletedAt ? "[removed by admin]" : t.title}
              </div>
              <div className="mt-0.5 text-[11px] text-muted flex items-center gap-2">
                <span className="truncate">{t.authorName}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
