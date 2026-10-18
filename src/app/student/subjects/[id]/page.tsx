import { notFound } from "next/navigation";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import { CurriculumRail } from "@/components/subjects/curriculum-rail";
import { requireRole } from "@/lib/auth";
import { getStudentSubjectPage } from "../_lib/subject-page";
import { subjectTone } from "@/lib/subject-tone";
import { SubjectHeader } from "./_components/subject-header";
import { SubjectNotice, SubjectWeekBody } from "./_components/week-body";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ term?: string; week?: string }>;

/*
 * My subjects, colourful option of the student design handoff
 * (StudentSubjectColourPage): the list and the detail merged into one page.
 * Subject tabs in the hero, the shared weeks rail on the left, then the
 * week's overview, lesson and materials, homework and quiz, and the tutor's
 * note.
 */
export default async function StudentSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("student");
  const { id: subjectId } = await params;
  const { term, week: weekParam } = await searchParams;
  const now = new Date();

  const page = await getStudentSubjectPage(user.id, subjectId, term, weekParam, now);
  if (page.kind === "not-enrolled") notFound();

  if (page.kind === "no-curriculum") {
    return (
      <div className="flex flex-col gap-5 text-ink">
        <SubjectHeader
          tabs={page.tabs}
          subjectId={subjectId}
          subjectName={page.subjectName}
          subjectColor={page.subjectColor}
          title={page.subjectName}
        />
        <SubjectNotice>Your tutor is preparing this term&apos;s lessons. They appear here once they&apos;re ready.</SubjectNotice>
      </div>
    );
  }

  const { data, week, tasks, progress, tutorFirstName } = page;
  return (
    <div className="flex flex-col gap-5 text-ink">
      <SubjectHeader
        tabs={page.tabs}
        subjectId={subjectId}
        subjectName={data.subjectName}
        subjectColor={data.subjectColor}
        title={week?.title ?? data.subjectName}
        kicker={[week ? `Week ${week.weekNumber}` : null, data.tutorName]
          .filter(Boolean)
          .join(" · ")}
        progress={progress}
        tutorId={data.tutorId}
        tutorFirstName={tutorFirstName}
      />

      <CurriculumLayout
        attached
        framed
        defaultOpen
        rail={
          <CurriculumRail
            basePath={`/student/subjects/${subjectId}`}
            currentTermId={data.currentTerm.id}
            terms={data.termsAvailable.map((t) => ({
              id: t.id,
              label: `Term ${t.termNumber} · ${t.year}`,
            }))}
            weeks={page.railWeeks}
            selectedWeekId={week?.subjectWeekId ?? null}
            currentWeekIdHint={page.currentWeekId}
            showTermSelect
            accent={subjectTone(data.subjectName, data.subjectColor).flat}
          />
        }
      >
        {week ? (
          <SubjectWeekBody
            week={week}
            tasks={tasks}
            subjectName={data.subjectName}
            subjectColor={data.subjectColor}
            videoSrc={page.videoSrc}
            tutorFirstName={tutorFirstName}
            now={now}
          />
        ) : (
          <SubjectNotice>
            {page.firstUnlock
              ? `Week 1 is locked. ${page.firstUnlock}.`
              : "This term's lessons are locked."}
          </SubjectNotice>
        )}
      </CurriculumLayout>
    </div>
  );
}
