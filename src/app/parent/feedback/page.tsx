import Link from "next/link";
import { Card, PageHeader, Empty } from "@/components/parent/ui";
import { SubjectPill } from "@/components/data/subject-pill";
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
        <PageHeader
          title="Tutor feedback"
        />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getFeedback(selected.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Feedback for ${selected.firstName}`}
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            children={children}
            selectedId={selected.id}
            basePath="/parent/feedback"
          />
        </div>
      )}

      <div className="rise space-y-4" style={{ animationDelay: "60ms" }}>
        {rows.length === 0 ? (
          <Card>
            <Empty>
              No tutor feedback yet. Notes will appear here after each of{" "}
              {selected.firstName}'s lessons.
            </Empty>
          </Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line">
                <div className="flex items-center gap-2.5 min-w-0">
                  <SubjectPill name={r.subjectName ?? "Lesson"} />
                  {r.topicCovered && (
                    <span className="text-[15px] font-extrabold tracking-[-0.01em] text-ink truncate">
                      {r.topicCovered}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted font-semibold shrink-0">
                  {formatDateLong(r.lessonDate)} · {r.tutorName}
                </div>
              </div>
              <div className="px-5 py-5">
                <p className="text-lg text-ink leading-relaxed">
                  {r.parentVisibleComment}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted">
                    {relativeTime(r.createdAt)}
                  </div>
                  <Link
                    href={`/parent/classes/${r.classId}?child=${selected.id}`}
                    className="text-[12px] font-bold text-brand-700 hover:text-brand-800 shrink-0"
                  >
                    View class →
                  </Link>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
