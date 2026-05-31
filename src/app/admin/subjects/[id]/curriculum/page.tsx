import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { db } from "@/db/client";
import { subjectWeeks, subjects, terms } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { WeekStripAdmin } from "./_components/week-strip-admin";
import { WeekEditor } from "./_components/week-editor";

type SearchParams = Promise<{ term?: string; week?: string; new?: string }>;

export default async function AdminSubjectCurriculumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  await requireRole("admin");
  const { id: subjectId } = await params;
  const { term: termParam, week: weekParam, new: isNew } = await searchParams;

  const [subject] = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  if (!subject) notFound();

  const allTerms = await db
    .select()
    .from(terms)
    .orderBy(desc(terms.year), desc(terms.termNumber));
  const currentTerm = termParam
    ? allTerms.find((t) => t.id === termParam)
    : ((await resolveCurrentTerm()) ?? allTerms[0]);

  if (!currentTerm) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-medium text-ink">
          {subject.name} — Curriculum
        </h1>
        <p className="text-sm text-ink-soft">
          No terms defined yet.{" "}
          <Link href="/admin/terms" className="text-brand-700 hover:underline">
            Create one →
          </Link>
        </p>
      </div>
    );
  }

  const weeks = await db
    .select()
    .from(subjectWeeks)
    .where(
      and(
        eq(subjectWeeks.subjectId, subjectId),
        eq(subjectWeeks.termId, currentTerm.id),
      ),
    )
    .orderBy(asc(subjectWeeks.weekNumber));

  const selectedWeek = weekParam
    ? weeks.find((w) => w.id === weekParam)
    : weeks[0];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/classes"
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← Back to classes
      </Link>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
          <h1 className="text-3xl lg:text-4xl font-medium tracking-tight text-ink truncate">
            {subject.name} — Curriculum
          </h1>
          <p className="text-sm text-ink-soft mt-1 truncate">
            {currentTerm.year} · Term {currentTerm.termNumber} ·{" "}
            {currentTerm.startDate} to {currentTerm.endDate}
          </p>
        </div>

        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 p-6">
          <WeekStripAdmin
            weeks={weeks}
            terms={allTerms}
            currentTermId={currentTerm.id}
            subjectId={subjectId}
            selectedWeekId={selectedWeek?.id ?? null}
          />
          <div className="lg:border-l lg:border-hairline/60 lg:pl-6">
            {isNew || !selectedWeek ? (
              <WeekEditor subjectId={subjectId} termId={currentTerm.id} />
            ) : (
              <WeekEditor
                existing={selectedWeek}
                subjectId={subjectId}
                termId={currentTerm.id}
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
