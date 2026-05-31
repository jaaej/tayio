import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { classes, enrollments } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { currentWeekNumber } from "@/lib/curriculum";
import { getStudentCurriculum } from "./_queries";
import { WeekStrip } from "./_components/week-strip";
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

  const weekStripItems = data.weeks.map((w) => ({
    subjectWeekId: w.subjectWeekId,
    weekNumber: w.weekNumber,
    title: w.title,
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

  return (
    <div className="space-y-6">
      <Link
        href="/student/subjects"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← All subjects
      </Link>

      <Card className="p-0 overflow-hidden">
        {/* Header strip — colored tab */}
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl lg:text-4xl font-medium tracking-tight text-ink truncate">
                {data.subjectName}
              </h1>
              <p className="text-sm text-ink-soft mt-1 truncate">
                {data.className} · {data.currentTerm.year} · Term{" "}
                {data.currentTerm.termNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Week sidebar + content side-by-side, all in one card */}
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6 p-6">
          <WeekStrip
            subjectId={subjectId}
            currentTermId={data.currentTerm.id}
            termsAvailable={data.termsAvailable}
            weeks={weekStripItems}
            selectedWeekId={data.selectedWeekId}
            currentWeekIdHint={currentWeekHint}
          />
          <div className="lg:border-l lg:border-hairline/60 lg:pl-6">
            <WeekContent week={selectedWeek} classId={data.classId} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyCurriculum() {
  return (
    <div className="space-y-4">
      <Link
        href="/student/subjects"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← All subjects
      </Link>
      <div className="rounded-xl border border-hairline/60 bg-card p-6 text-sm text-ink-soft">
        Curriculum coming soon — your tutor is preparing this term's content.
      </div>
    </div>
  );
}
