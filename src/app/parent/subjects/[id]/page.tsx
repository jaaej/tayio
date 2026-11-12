import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import { CurriculumRail } from "@/components/subjects/curriculum-rail";
import { requireRole } from "@/lib/auth";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { subjectTone } from "@/lib/subject-tone";
import { getStudentSubjectPage } from "@/app/student/subjects/_lib/subject-page";
import { SubjectHeader } from "@/app/student/subjects/[id]/_components/subject-header";
import {
  SubjectNotice,
  SubjectWeekBody,
} from "@/app/student/subjects/[id]/_components/week-body";
import { resolveSelectedChild } from "../../_data";
import { EmptyChildrenNotice } from "../../_components/empty-children";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ child?: string; term?: string; week?: string; tab?: string }>;

/**
 * One subject of the child's: the student's own subject page (hero with the
 * child's subjects as tabs, the weeks rail and the week), read only.
 * Attendance lives on the Timetable and tutor feedback on Feedback, one home
 * each; the old `?tab=attendance` and `?tab=feedback` links forward there.
 */
export default async function ParentSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const [{ id: subjectId }, sp] = await Promise.all([params, searchParams]);
  const { selected } = await resolveSelectedChild(user.id, sp.child);
  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Subjects" />
        <EmptyChildrenNotice />
      </div>
    );
  }

  if (sp.tab === "attendance") redirect(`/parent/timetable?child=${selected.id}#attendance`);
  if (sp.tab === "feedback") redirect(`/parent/feedback?child=${selected.id}`);

  const now = new Date();
  const page = await getStudentSubjectPage(selected.id, subjectId, sp.term, sp.week, now);
  if (page.kind === "not-enrolled") notFound();

  const childQs = `?child=${selected.id}`;
  const subjectName = page.kind === "ready" ? page.data.subjectName : page.subjectName;
  const subjectColor = page.kind === "ready" ? page.data.subjectColor : page.subjectColor;

  const header =
    page.kind === "ready" ? (
      <SubjectHeader
        tabs={page.tabs}
        subjectId={subjectId}
        subjectName={subjectName}
        subjectColor={subjectColor}
        title={page.week?.title ?? subjectName}
        kicker={[page.week ? `Week ${page.week.weekNumber}` : null, page.data.tutorName]
          .filter(Boolean)
          .join(" · ")}
        progress={page.progress}
        tutorId={page.data.tutorId}
        tutorFirstName={page.tutorFirstName}
        basePath="/parent/subjects"
        query={childQs}
        messageBase="/parent/messages/with"
      />
    ) : (
      <SubjectHeader
        tabs={page.tabs}
        subjectId={subjectId}
        subjectName={subjectName}
        subjectColor={subjectColor}
        title={subjectName}
        basePath="/parent/subjects"
        query={childQs}
      />
    );

  return (
    <div className="flex flex-col gap-5 text-ink">
      {header}
      {page.kind === "no-curriculum" ? (
        <SubjectNotice>
          The tutor is preparing this term&apos;s lessons. They appear here once they&apos;re ready.
        </SubjectNotice>
      ) : (
        <CurriculumLayout
          attached
          framed
          defaultOpen
          rail={
            <CurriculumRail
              basePath={`/parent/subjects/${subjectId}`}
              extraParams={{ child: selected.id }}
              currentTermId={page.data.currentTerm.id}
              terms={page.data.termsAvailable.map((t) => ({
                id: t.id,
                label: `Term ${t.termNumber} · ${t.year}`,
              }))}
              weeks={page.railWeeks}
              selectedWeekId={page.week?.subjectWeekId ?? null}
              currentWeekIdHint={page.currentWeekId}
              showTermSelect
              accent={subjectTone(subjectName, subjectColor).flat}
            />
          }
        >
          {page.week ? (
            <SubjectWeekBody
              week={page.week}
              tasks={page.tasks}
              subjectName={subjectName}
              subjectColor={subjectColor}
              videoSrc={page.videoSrc}
              tutorFirstName={page.tutorFirstName}
              parent={{
                childId: selected.id,
                bookletSrc: await signCurriculumUrl(page.week.bookletUrl),
              }}
            />
          ) : (
            <SubjectNotice>
              {page.firstUnlock
                ? `Week 1 is locked. ${page.firstUnlock}.`
                : "This term's lessons are locked."}
            </SubjectNotice>
          )}
        </CurriculumLayout>
      )}
    </div>
  );
}
