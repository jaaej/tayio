import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHead } from "@/components/student/card";
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
    <div className="space-y-5">
      <Link
        href={`/tutor/classes`}
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-600 hover:text-brand-700"
      >
        ← Back to classes
      </Link>

      <Card className="overflow-hidden">
        <CardHead
          title={
            <span className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.12em] text-muted font-bold">
                {data.subjectName} · {data.currentTerm.year} · Term{" "}
                {data.currentTerm.termNumber}
              </span>
              <span className="text-[16px] font-extrabold text-ink mt-0.5 truncate">
                {data.className} — Curriculum
              </span>
            </span>
          }
        />

        {data.weeks.length === 0 ? (
          <div className="p-4 text-sm text-muted text-center">
            No curriculum has been set up for {data.subjectName} this term yet.
          </div>
        ) : (
          <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-5 p-4">
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
            <div className="lg:border-l lg:border-line lg:pl-5">
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
