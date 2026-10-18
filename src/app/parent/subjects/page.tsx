import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { getSubjectTabs } from "@/app/student/subjects/_lib/subject-page";
import { resolveSelectedChild } from "../_data";
import { EmptyChildrenNotice } from "../_components/empty-children";

export const dynamic = "force-dynamic";

/**
 * Subjects has no list of its own, as for students: the subject page carries
 * the child's subjects as tabs, so this opens the first one.
 */
export default async function ParentSubjectsIndex({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const user = await requireRole("parent");
  const { child } = await searchParams;
  const { selected } = await resolveSelectedChild(user.id, child);
  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Subjects" />
        <EmptyChildrenNotice />
      </div>
    );
  }
  const tabs = await getSubjectTabs(selected.id);
  if (tabs.length > 0) redirect(`/parent/subjects/${tabs[0].subjectId}?child=${selected.id}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Subjects" />
      <div className="glass rounded-[24px] p-1.5">
        <p className="panel px-5 py-10 text-center text-[14px] text-muted">
          {selected.firstName} isn&apos;t in any classes yet. Subjects appear here once they&apos;re enrolled.
        </p>
      </div>
    </div>
  );
}
