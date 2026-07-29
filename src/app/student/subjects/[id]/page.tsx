import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Card, CardBody } from "@/components/student/card";
import { db } from "@/db/client";
import { classes, enrollments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { currentWeekNumber } from "@/lib/curriculum";
import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";
import { getStudentCurriculum } from "./_queries";
import { WeekStrip } from "./_components/week-strip";
import { WeekContent } from "./_components/week-content";
import { TermTestCard } from "./_components/term-test-card";

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

  const weekStripItems = data.weeks.map((w) => ({
    subjectWeekId: w.subjectWeekId,
    weekNumber: w.weekNumber,
    title: w.title,
    topicId: w.topicId,
    topicName: w.topicName,
    videoWatched: Boolean(w.videoWatchedAt),
    bookletOpened: Boolean(w.bookletOpenedAt),
    homeworkTotal: w.homework.length,
    homeworkDone: w.homework.filter(
      (h) =>
        h.status === "marked" ||
        h.status === "submitted" ||
        h.status === "returned",
    ).length,
  }));

  const tokens = getAccentTokens(colorFamilyForSubject(data.subjectName));
  const initial = data.subjectName.charAt(0).toUpperCase();

  // Bleed the entire page past the global shell's px-5/lg:px-7 padding and
  // re-add a smaller inner padding so the subject view takes the whole main
  // area (next to the nav sidebar) instead of being inset like other pages.
  return (
    <div className="-mx-5 lg:-mx-7 -mt-6 -mb-6 lg:-mb-16 min-h-[calc(100vh-56px)] flex flex-col">
      {/* Header bar — neutral chrome. Subject identity carried by the
          tinted initial tile + h1, not by tinting the whole bar
          (avoids breaking visual hierarchy with the rail + hero). */}
      <div className="px-5 lg:px-7 pt-2 pb-2.5 border-b border-line bg-background">
        <Link
          href="/student/subjects"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-ink"
        >
          ← All subjects
        </Link>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span
            aria-hidden
            className="h-9 w-9 rounded-[10px] grid place-items-center text-[17px] font-extrabold shrink-0"
            style={{ background: tokens.bgFrom, color: tokens.arrow }}
          >
            {initial}
          </span>
          <h1
            className="m-0 text-[20px] font-extrabold tracking-[-0.01em] leading-none"
            style={{ color: tokens.title }}
          >
            {data.subjectName}
          </h1>
        </div>
      </div>

      {/* Full-bleed 2-col: skinnier rail, content fills the rest */}
      <div className="flex-1 grid lg:grid-cols-[248px_minmax(0,1fr)] gap-3 lg:gap-4 px-3 lg:px-4 py-3 items-start">
        <WeekStrip
          subjectId={subjectId}
          currentTermId={data.currentTerm.id}
          termsAvailable={data.termsAvailable}
          weeks={weekStripItems}
          selectedWeekId={data.selectedWeekId}
          currentWeekIdHint={currentWeekHint}
          accent={tokens}
        />
        <div className="space-y-3.5">
          {data.termTest && (
            <TermTestCard termTest={data.termTest} accent={tokens} />
          )}
          <WeekContent
            week={selectedWeek}
            subjectName={data.subjectName}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyCurriculum() {
  return (
    <div className="space-y-4">
      <Link
        href="/student/subjects"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted hover:text-ink"
      >
        ← All subjects
      </Link>
      <Card>
        <CardBody>
          <div className="text-sm text-muted">
            Curriculum coming soon — your tutor is preparing this term's content.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
