import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Card, Hero, HeroChip, BackLink } from "@/components/admin/ui";
import { db } from "@/db/client";
import { subjectWeeks, subjects, terms, subjectTopics } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { WeekStripAdmin } from "./_components/week-strip-admin";
import { WeekEditor } from "./_components/week-editor";
import { TopicsPanel } from "./_components/topics-panel";

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
        <BackLink href="/admin/classes">Back to classes</BackLink>
        <Hero
          eyebrow="Curriculum"
          title={subject.name}
          icon={subject.name.charAt(0).toUpperCase()}
        />
        <p className="text-[13px] text-ink-soft">
          No terms defined yet.{" "}
          <Link href="/admin/terms" className="text-brand-600 font-semibold hover:underline">
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

  const topics = await db
    .select()
    .from(subjectTopics)
    .where(eq(subjectTopics.subjectId, subjectId))
    .orderBy(asc(subjectTopics.position));

  const countRows = await db
    .select({ topicId: subjectWeeks.topicId, n: sql<number>`count(*)::int` })
    .from(subjectWeeks)
    .where(eq(subjectWeeks.subjectId, subjectId))
    .groupBy(subjectWeeks.topicId);
  const weekCounts: Record<string, number> = {};
  for (const r of countRows) if (r.topicId) weekCounts[r.topicId] = r.n;

  const selectedWeek = weekParam
    ? weeks.find((w) => w.id === weekParam)
    : weeks[0];

  return (
    <div className="space-y-6">
      <BackLink href="/admin/classes">Back to classes</BackLink>

      <Hero
        eyebrow="Curriculum"
        title={subject.name}
        icon={subject.name.charAt(0).toUpperCase()}
        chips={
          <>
            <HeroChip>{currentTerm.year}</HeroChip>
            <HeroChip>Term {currentTerm.termNumber}</HeroChip>
            <HeroChip>
              {currentTerm.startDate} – {currentTerm.endDate}
            </HeroChip>
          </>
        }
      />

      <Card>
        <div className="p-6 pb-0">
          <TopicsPanel subjectId={subjectId} topics={topics} weekCounts={weekCounts} />
        </div>
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 p-6">
          <WeekStripAdmin
            weeks={weeks}
            terms={allTerms}
            currentTermId={currentTerm.id}
            subjectId={subjectId}
            selectedWeekId={selectedWeek?.id ?? null}
          />
          <div className="lg:border-l lg:border-line lg:pl-6">
            {isNew || !selectedWeek ? (
              <WeekEditor subjectId={subjectId} termId={currentTerm.id} topics={topics} />
            ) : (
              <WeekEditor
                existing={selectedWeek}
                subjectId={subjectId}
                termId={currentTerm.id}
                topics={topics}
              />
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
