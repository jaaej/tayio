import { notFound } from "next/navigation";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import { CurriculumRail } from "@/components/subjects/curriculum-rail";
import { requireRole } from "@/lib/auth";
import { getStudentSubjectPage } from "../_lib/subject-page";
import type { ChecklistTask } from "../_lib/week-checklist";
import type { StudentCurriculumWeek } from "./_queries";
import { subjectTone } from "@/lib/subject-tone";
import { SubjectHeader } from "./_components/subject-header";
import { LessonMaterials } from "./_components/lesson-materials";
import { Overview, TutorNote, WeekHomework, WeeklyQuiz } from "./_components/week-panels";

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
          <WeekBody
            week={week}
            tasks={tasks}
            subjectName={data.subjectName}
            subjectColor={data.subjectColor}
            videoSrc={page.videoSrc}
            tutorFirstName={tutorFirstName}
            now={now}
          />
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

function WeekBody({
  week,
  tasks,
  subjectName,
  subjectColor,
  videoSrc,
  tutorFirstName,
  now,
}: {
  week: StudentCurriculumWeek;
  tasks: ChecklistTask[];
  subjectName: string;
  subjectColor: string | null;
  videoSrc: string | null;
  tutorFirstName: string | null;
  now: Date;
}) {
  const video = tasks.find((t) => t.kind === "video");
  const booklet = tasks.find((t) => t.kind === "booklet");
  const quiz = tasks.find((t) => t.kind === "quiz");
  const showQuiz = Boolean(quiz) || week.quizInProgress;
  return (
    <div className="flex flex-col gap-5">
      <Overview week={week} subjectName={subjectName} subjectColor={subjectColor} />
      {video && booklet && (
        <LessonMaterials
          video={video}
          booklet={booklet}
          videoSrc={videoSrc}
          subjectWeekId={week.subjectWeekId}
          accent={subjectTone(subjectName, subjectColor).flat}
        />
      )}
      <div className={showQuiz ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]" : undefined}>
        <WeekHomework tasks={tasks.filter((t) => t.kind === "homework")} />
        <WeeklyQuiz task={quiz} inProgress={week.quizInProgress} tutorFirstName={tutorFirstName} />
      </div>
      <TutorNote
        week={week}
        subjectName={subjectName}
        subjectColor={subjectColor}
        tutorFirstName={tutorFirstName}
        now={now}
      />
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
