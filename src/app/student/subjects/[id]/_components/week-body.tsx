import type { ChecklistTask } from "../../_lib/week-checklist";
import type { StudentCurriculumWeek } from "../_queries";
import { subjectTone } from "@/lib/subject-tone";
import { LessonMaterials } from "./lesson-materials";
import { TutorNote, WeekHomework, WeeklyQuiz } from "./week-panels";
import { WeekOverview } from "@/components/subjects/week-overview";

/**
 * One curriculum week as the student works through it: overview, lesson and
 * materials, homework and quiz, and the tutor's note. The parent's subject
 * page shows the same week for their child (`parent`): read only, with the
 * child's status, and homework opening the parent's copy.
 */
export function SubjectWeekBody({
  week,
  tasks,
  subjectName,
  subjectColor,
  videoSrc,
  tutorFirstName,
  now,
  parent,
}: {
  week: StudentCurriculumWeek;
  tasks: ChecklistTask[];
  subjectName: string;
  subjectColor: string | null;
  videoSrc: string | null;
  tutorFirstName: string | null;
  now: Date;
  parent?: { childId: string; bookletSrc: string | null };
}) {
  const video = tasks.find((t) => t.kind === "video");
  const booklet = tasks.find((t) => t.kind === "booklet");
  const quiz = tasks.find((t) => t.kind === "quiz");
  const showQuiz = Boolean(quiz) || week.quizInProgress;
  return (
    <div className="flex flex-col gap-5">
      <WeekOverview
        subjectName={subjectName}
        subjectColor={subjectColor}
        description={week.description}
        objectives={week.objectives}
      />
      {video && booklet && (
        <LessonMaterials
          video={video}
          booklet={booklet}
          videoSrc={videoSrc}
          subjectWeekId={week.subjectWeekId}
          accent={subjectTone(subjectName, subjectColor).flat}
          readOnly={parent ? { bookletSrc: parent.bookletSrc } : undefined}
        />
      )}
      <div className={showQuiz ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]" : undefined}>
        <WeekHomework
          tasks={tasks.filter((t) => t.kind === "homework")}
          hrefFor={
            parent
              ? (task) =>
                  `/parent/homework/${task.key.replace(/^homework-/, "")}?child=${parent.childId}`
              : undefined
          }
        />
        <WeeklyQuiz
          task={quiz}
          inProgress={week.quizInProgress}
          tutorFirstName={tutorFirstName}
          readOnly={Boolean(parent)}
        />
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

/** A full-width message in the subject page's frame. */
export function SubjectNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-[24px] p-1.5">
      <p className="panel px-5 py-10 text-center text-[14px] text-[#5E5A73]">{children}</p>
    </div>
  );
}
