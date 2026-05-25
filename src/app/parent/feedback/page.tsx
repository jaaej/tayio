import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
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
      <div className="space-y-12">
        <Header />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const rows = await getFeedback(selected.id);

  return (
    <div className="space-y-10">
      <Header subtitle={selected.firstName} />
      <ChildSwitcher
        children={children}
        selectedId={selected.id}
        basePath="/parent/feedback"
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-ink-soft">
            No tutor feedback yet. Notes appear here after each lesson.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between gap-4 text-xs text-muted">
                <div>
                  <span className="uppercase tracking-[0.16em]">
                    {r.subjectName ?? "Lesson"}
                  </span>
                  {r.topicCovered ? (
                    <span className="ml-2 text-ink-soft">· {r.topicCovered}</span>
                  ) : null}
                </div>
                <div>
                  {formatDate(r.lessonDate)} · {r.tutorName}
                </div>
              </div>
              <p className="mt-4 text-lg text-ink leading-relaxed">
                {r.parentVisibleComment}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="rise">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
        Tutor feedback
      </div>
      <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
        {subtitle ? (
          <>
            Notes for{" "}
            <span className="">{subtitle}</span>
          </>
        ) : (
          "Tutor feedback"
        )}
      </h1>
    </header>
  );
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
