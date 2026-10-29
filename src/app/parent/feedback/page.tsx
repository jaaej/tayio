import { PageHeader } from "@/components/admin/ui";
import { RecapCard } from "@/components/lessons/lesson-recap";
import { requireRole } from "@/lib/auth";
import { getFamilyRecaps } from "@/lib/lesson-recap";
import { resolveSelectedChild } from "../_data";
import { EmptyChildrenNotice } from "../_components/empty-children";

type SearchParams = Promise<{ child?: string }>;

/** Every lesson recap the tutors wrote for the child, newest first. */
export default async function ParentFeedbackPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { child: requested } = await searchParams;
  const { selected } = await resolveSelectedChild(user.id, requested);

  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Tutor feedback" />
        <EmptyChildrenNotice />
      </div>
    );
  }

  const recaps = await getFamilyRecaps(selected.id);

  return (
    <div className="flex max-w-[1080px] flex-col gap-5">
      <PageHeader title={`Feedback for ${selected.firstName}`} />
      {recaps.length === 0 ? (
        <div className="glass rounded-[24px] p-1.5">
          <p className="panel px-5 py-10 text-center text-[14px] text-muted">
            No tutor feedback yet. When a tutor leaves a comment after one of{" "}
            {selected.firstName}&apos;s lessons, it appears here.
          </p>
        </div>
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
  );
}
