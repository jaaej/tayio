import { notFound } from "next/navigation";
import { LessonRecapView } from "@/components/lessons/lesson-recap";
import { requireRole } from "@/lib/auth";
import { getFamilyRecap } from "@/lib/lesson-recap";
import { resolveSelectedChild } from "../../_data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One lesson's recap for a linked child, the view the student has on
 * /student/resources/[id]. The selected child is tried first, so siblings
 * in the same class each see their own recap.
 */
export default async function ParentRecapPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const user = await requireRole("parent");
  const [{ lessonId }, { child: requested }] = await Promise.all([params, searchParams]);
  if (!UUID.test(lessonId)) notFound();
  const { children, selected } = await resolveSelectedChild(user.id, requested);
  const ordered = [
    ...children.filter((c) => c.id === selected?.id),
    ...children.filter((c) => c.id !== selected?.id),
  ];
  for (const child of ordered) {
    const recap = await getFamilyRecap(child.id, lessonId);
    if (!recap) continue;
    return (
      <LessonRecapView
        recap={recap}
        back={{ href: `/parent/feedback?child=${child.id}`, label: "All feedback" }}
        emptyText={`The tutor hasn't written a recap for ${child.firstName} for this lesson yet.`}
      />
    );
  }
  notFound();
}
