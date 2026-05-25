import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { formatDateLong, relativeTime } from "@/lib/format";
import { getFeedback, resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";

type SearchParams = Promise<{ child?: string }>;

export default async function ParentFeedbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { children, selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getFeedback(selected.id);

  return (
    <div className="space-y-6">
      <Header subtitle={selected.firstName} />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/feedback"
          />
        </div>
      )}

      <div className="rise space-y-5" style={{ animationDelay: "60ms" }}>
        {rows.length === 0 ? (
          <Card>
            <p className="text-ink-soft">
              No tutor feedback yet. Notes will appear here after each of{" "}
              {selected.firstName}'s lessons.
            </p>
          </Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted">
                <div className="min-w-0 truncate">
                  {r.subjectName ?? "Lesson"}
                  {r.topicCovered ? (
                    <span className="ml-2 text-ink-soft normal-case tracking-normal">
                      · {r.topicCovered}
                    </span>
                  ) : null}
                </div>
                <div className="shrink-0">
                  {formatDateLong(r.lessonDate)} · {r.tutorName}
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-lg text-ink leading-relaxed">
                  {r.parentVisibleComment}
                </p>
                <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted">
                  {relativeTime(r.createdAt)}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-600" />
        Tutor feedback
      </div>
      <h1 className="mt-1 text-4xl lg:text-5xl font-medium tracking-tight text-ink">
        {subtitle ? `Notes for ${subtitle}` : "Tutor feedback"}
      </h1>
    </header>
  );
}
