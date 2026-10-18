import { notFound } from "next/navigation";
import { LessonRecapView } from "@/components/lessons/lesson-recap";
import { requireRole } from "@/lib/auth";
import { getFamilyRecap } from "@/lib/lesson-recap";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One lesson's recap and recording, the same view the parent has. */
export default async function LessonRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole("student");
  if (!UUID.test(id)) notFound();
  const recap = await getFamilyRecap(user.id, id);
  if (!recap) notFound();

  return (
    <LessonRecapView
      recap={recap}
      back={{ href: "/student/resources", label: "All resources" }}
      emptyText="Your tutor hasn't written a recap for this lesson yet. Check back later."
    />
  );
}
