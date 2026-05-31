import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getTutorCurriculum } from "./_queries";
import { WeekStripTutor } from "./_components/week-strip-tutor";
import { OverrideEditor } from "./_components/override-editor";

type SearchParams = Promise<{ term?: string; week?: string }>;

export default async function TutorClassCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("tutor");
  const { id: classId } = await params;
  const { term: termParam, week: weekParam } = await searchParams;

  const data = await getTutorCurriculum(user.id, classId, termParam);
  if (!data) notFound();

  const selected =
    data.weeks.find((w) => w.subjectWeekId === weekParam) ?? data.weeks[0];

  return (
    <div className="space-y-6">
      <Link
        href={`/tutor/classes`}
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← Back to classes
      </Link>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
          <h1 className="text-3xl lg:text-4xl font-medium tracking-tight text-ink truncate">
            {data.className} — Curriculum
          </h1>
          <p className="text-sm text-ink-soft mt-1 truncate">
            {data.subjectName} · {data.currentTerm.year} · Term{" "}
            {data.currentTerm.termNumber}
          </p>
        </div>

        {data.weeks.length === 0 ? (
          <div className="p-6 text-sm text-ink-soft">
            No curriculum has been set up for {data.subjectName} this term yet.
            An admin needs to seed weeks before you can override.
          </div>
        ) : (
          <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6 p-6">
            <WeekStripTutor
              classId={classId}
              currentTermId={data.currentTerm.id}
              termsAvailable={data.termsAvailable}
              weeks={data.weeks.map((w) => ({
                subjectWeekId: w.subjectWeekId,
                weekNumber: w.weekNumber,
                title: w.title,
                hasOverride: w.hasOverride,
                homeworkCount: w.homework.length,
              }))}
              selectedWeekId={selected?.subjectWeekId ?? null}
            />
            <div className="lg:border-l lg:border-hairline/60 lg:pl-6">
              {selected && (
                <OverrideEditor classId={classId} week={selected} />
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
