import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { getSubjectTabs } from "./_lib/subject-page";

export const dynamic = "force-dynamic";

/**
 * My subjects has no list page of its own: the subject page carries the
 * subject tabs, so this opens the first subject on its current week.
 */
export default async function StudentSubjectsIndex() {
  const user = await requireRole("student");
  const tabs = await getSubjectTabs(user.id);
  if (tabs.length > 0) redirect(`/student/subjects/${tabs[0].subjectId}`);

  return (
    <div className="space-y-5">
      <PageHeader title="My subjects" />
      <div className="glass rounded-[24px] p-1.5">
        <p className="panel px-5 py-10 text-center text-[14px] text-muted">
          You&apos;re not in any classes yet. Your subjects appear here once you&apos;re enrolled.
        </p>
      </div>
    </div>
  );
}
