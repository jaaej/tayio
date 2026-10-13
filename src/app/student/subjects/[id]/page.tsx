import { notFound } from "next/navigation";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import { CurriculumRail } from "@/components/subjects/curriculum-rail";
import { requireRole } from "@/lib/auth";
import { getStudentSubjectPage } from "../_lib/subject-page";
import { subjectBg } from "./_components/subject-colour";
import { SubjectHeader } from "./_components/subject-header";
import { Recording, TutorNote, WeekGoals } from "./_components/week-panels";
import { WeekWork } from "./_components/week-work";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ term?: string; week?: string }>;

/*
 * My subjects, colourful option of the student design handoff
 * (StudentSubjectColourPage): the list and the detail merged into one page.
 * Subject tabs in the hero, the shared weeks rail on the left, this week's
 * work as colour cards, then the objectives and the tutor's note.
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
          title={page.subjectName}
        />
        <Notice>Your tutor is preparing this term&apos;s lessons. They appear here once they&apos;re ready.</Notice>
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
            accent={subjectBg(data.subjectName)}
          />
        }
      >
        {week ? (
          <div className="flex flex-col gap-5">
            <WeekWork tasks={tasks} subjectWeekId={week.subjectWeekId} />
            <div className="flex flex-wrap gap-5">
              <WeekGoals week={week} subjectName={data.subjectName} />
              <TutorNote
                week={week}
                subjectName={data.subjectName}
                tutorFirstName={tutorFirstName}
                now={now}
              />
            </div>
            <Recording week={week} src={page.videoSrc} />
          </div>
        ) : (
          <Notice>
            {page.firstUnlock
              ? `Week 1 is locked. ${page.firstUnlock}.`
              : "This term's lessons are locked."}
          </Notice>
        )}
      </CurriculumLayout>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-[24px] p-1.5">
      <p className="panel px-5 py-10 text-center text-[14px] text-[#5E5A73]">{children}</p>
    </div>
  );
}
