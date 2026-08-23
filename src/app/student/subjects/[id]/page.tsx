import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Card, CardBody } from "@/components/student/card";
import { db } from "@/db/client";
import { classes, enrollments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { currentWeekNumber } from "@/lib/curriculum";
import { getStudentCurriculum } from "./_queries";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import {
  CurriculumRail,
  type RailWeek,
} from "@/components/subjects/curriculum-rail";
import { WeekContent } from "./_components/week-content";

type SearchParams = Promise<{ term?: string; week?: string }>;

export default async function StudentSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("student");
  const { id: subjectId } = await params;
  const { term: termParam, week: weekParam } = await searchParams;

  const data = await getStudentCurriculum(user.id, subjectId, termParam, weekParam);
  if (!data) {
    const [stillEnrolled] = await db
      .select({ id: classes.id })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(
        and(
          eq(enrollments.studentId, user.id),
          eq(classes.subjectId, subjectId),
        ),
      )
      .limit(1);
    if (!stillEnrolled) notFound();
    return <EmptyCurriculum />;
  }

  const maxWeek = data.weeks.reduce(
    (acc, w) => Math.max(acc, w.weekNumber),
    0,
  );
  const currentWeekHint =
    data.weeks.find(
      (w) =>
        w.weekNumber ===
        currentWeekNumber(
          {
            startDate: data.currentTerm.startDate,
            endDate: data.currentTerm.endDate,
          },
          maxWeek,
        ),
    )?.subjectWeekId ?? null;

  const selectedWeek =
    data.weeks.find((w) => w.subjectWeekId === data.selectedWeekId) ??
    data.weeks.find((w) => w.subjectWeekId === currentWeekHint) ??
    data.weeks[0];

  const railWeeks: RailWeek[] = data.weeks.map((w) => {
    const homeworkTotal = w.homework.length;
    const homeworkDone = w.homework.filter(
      (h) =>
        h.status === "marked" ||
        h.status === "submitted" ||
        h.status === "returned",
    ).length;
    const tasksTotal = 2 + (homeworkTotal > 0 ? 1 : 0);
    const tasksDone =
      (w.videoWatchedAt ? 1 : 0) +
      (w.bookletOpenedAt ? 1 : 0) +
      (homeworkTotal > 0 && homeworkDone >= homeworkTotal ? 1 : 0);
    return {
      id: w.subjectWeekId,
      weekNumber: w.weekNumber,
      title: w.title,
      topicId: w.topicId,
      topicName: w.topicName,
      complete: tasksTotal > 0 && tasksDone === tasksTotal,
      pills:
        homeworkTotal > 0
          ? [
              {
                label: `${homeworkDone}/${homeworkTotal}`,
                tone: homeworkDone >= homeworkTotal ? "good" : "warn",
              },
            ]
          : [],
    };
  });

  // Bleed the entire page past the global shell's px-5/lg:px-7 padding and
  // re-add a smaller inner padding so the subject view takes the whole main
  // area (next to the nav sidebar) instead of being inset like other pages.
  //
  // The subject identity lives in the weeks tab (see CurriculumLayout) and the
  // way back out lives in the week hero, so nothing sits above the grid - the
  // hero runs straight into the top bar.
  return (
    <div
      className="-mx-5 lg:-mx-7 -mt-6 -mb-6 lg:-mb-16 min-h-[calc(100vh-56px)] flex flex-col"
    >
      {/* The subject is shown in the weeks tab, but the document still needs
          an h1 so the week hero's h2 isn't the first heading on the page. */}
      <h1 className="sr-only">{data.subjectName}</h1>

      {data.lessonPlan && (
        <div className="px-5 lg:px-7 pt-3">
          <Card>
            <CardBody>
              <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-muted mb-1.5">
                What's coming up
              </div>
              <p className="text-[13px] text-ink-soft whitespace-pre-wrap">
                {data.lessonPlan}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Full-bleed 2-col: rail attached to the nav, content fills the rest */}
      <CurriculumLayout
        attached
        subjectName={data.subjectName}
        rail={
          <CurriculumRail
            basePath={`/student/subjects/${subjectId}`}
            currentTermId={data.currentTerm.id}
            terms={data.termsAvailable.map((t) => ({
              id: t.id,
              label: `Term ${t.termNumber} · ${t.year}`,
            }))}
            weeks={railWeeks}
            selectedWeekId={data.selectedWeekId}
            currentWeekIdHint={currentWeekHint}
            showTermSelect={false}
          />
        }
      >
        <WeekContent
          week={selectedWeek}
          subjectName={data.subjectName}
          backHref="/student/subjects"
        />
      </CurriculumLayout>
    </div>
  );
}

function EmptyCurriculum() {
  return (
    <div className="space-y-4">
      <Link
        href="/student/subjects"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft hover:text-ink"
      >
        ← All subjects
      </Link>
      <Card>
        <CardBody>
          <div className="text-sm text-muted">
            Curriculum coming soon - your tutor is preparing this term's content.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
