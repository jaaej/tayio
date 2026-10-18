import { Card, PageHeader, Empty } from "@/components/parent/ui";
import { RecapCard } from "@/components/lessons/lesson-recap";
import { requireRole } from "@/lib/auth";
import { getFamilyRecaps } from "@/lib/lesson-recap";
import { resolveSelectedChild } from "../_data";
import { ChildSwitcher, EmptyChildrenNotice } from "../_components/child-switcher";

type SearchParams = Promise<{ child?: string }>;

/** Every lesson recap the tutors wrote for the child, newest first. */
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

  const recaps = await getFamilyRecaps(selected.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Feedback for ${selected.firstName}`}
      />

      {children.length > 1 && (
        <div className="rise" style={{ animationDelay: "20ms" }}>
          <ChildSwitcher
            students={children}
            selectedId={selected.id}
            basePath="/parent/feedback"
          />
        </div>
      )}

      <div className="rise flex flex-col gap-4" style={{ animationDelay: "60ms" }}>
        {recaps.length === 0 ? (
          <Card>
            <Empty>
              No tutor feedback yet. Notes will appear here after each of{" "}
              {selected.firstName}&apos;s lessons.
            </Empty>
          </Card>
        ) : (
          recaps.map((r) => (
            <RecapCard
              key={r.lessonId}
              recap={r}
              href={`/parent/feedback/${r.lessonId}?child=${selected.id}`}
            />
          ))
        )}
      </div>
    </div>
  );
}
