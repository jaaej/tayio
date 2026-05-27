import { Card } from "@/components/ui/card";
import type { ThreadDetail } from "@/lib/discussions-queries";
import { ReplyItem } from "@/components/discussions/reply-item";

export function QuestionBlock({ thread }: { thread: ThreadDetail }) {
  const title = thread.deletedAt ? "[removed by admin]" : thread.title;
  const body = thread.deletedAt ? "" : thread.body;
  const contextLabel = thread.subjectName ?? "Admin / Tech";
  const stamp = thread.createdAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <Card
      className="p-8 border-2 border-brand-400"
      style={{
        boxShadow:
          "0 0 0 4px rgba(94, 123, 199, 0.22), 0 0 0 10px rgba(94, 123, 199, 0.10), 0 24px 48px -16px rgba(94, 123, 199, 0.45)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] bg-brand-50 text-brand-700 border border-brand-200">
          Question
        </span>
        <span className="text-xs uppercase tracking-[0.14em] font-medium text-muted">
          {contextLabel}
        </span>
      </div>

      <h2 className="text-4xl font-semibold leading-[1.15] tracking-tight text-ink">
        {title}
      </h2>

      {body && (
        <p className="mt-5 text-lg whitespace-pre-wrap leading-relaxed text-ink">
          {body}
        </p>
      )}

      <div className="mt-7 pt-5 border-t border-hairline/60 flex items-center justify-between text-sm text-ink-soft">
        <span className="font-medium">
          Asked by {thread.authorName} · {thread.authorRole}
        </span>
        <span className="text-xs uppercase tracking-[0.14em] tabular-nums">
          {stamp}
        </span>
      </div>
    </Card>
  );
}

export function RepliesList({
  replies,
  threadId,
  rolePrefix,
}: {
  replies: ThreadDetail["replies"];
  threadId: string;
  rolePrefix: "student" | "tutor" | "admin";
}) {
  // Group: top-level replies + their children
  const topLevel = replies.filter((r) => r.parentReplyId === null);
  const childrenByParent = new Map<string, ThreadDetail["replies"]>();
  for (const r of replies) {
    if (r.parentReplyId) {
      const list = childrenByParent.get(r.parentReplyId) ?? [];
      list.push(r);
      childrenByParent.set(r.parentReplyId, list);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between text-xs uppercase tracking-[0.2em] font-medium text-ink-soft">
        <span>Replies</span>
        <span className="tabular-nums">{replies.length}</span>
      </div>
      {topLevel.length === 0 ? (
        <div className="text-sm text-ink-soft py-4">
          No replies yet. Be the first to chime in.
        </div>
      ) : (
        topLevel.map((r) => (
          <ReplyItem
            key={r.id}
            reply={r}
            childReplies={childrenByParent.get(r.id) ?? []}
            threadId={threadId}
            rolePrefix={rolePrefix}
          />
        ))
      )}
    </section>
  );
}

