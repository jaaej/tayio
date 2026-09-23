import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Hero, BackLink } from "@/components/admin/ui";
import { db } from "@/db/client";
import {
  profiles,
  quizzes,
  quizQuestions,
  subjectWeeks,
  subjects,
  terms,
  subjectTopics,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { CurriculumLayout } from "@/components/subjects/curriculum-layout";
import {
  CurriculumRail,
  type RailWeek,
} from "@/components/subjects/curriculum-rail";
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
        <BackLink href="/admin/classes">Back to classes</BackLink>
        <Hero
          eyebrow="Curriculum"
          title={subject.name}
          icon={subject.name.charAt(0).toUpperCase()}
        />
        <p className="text-[13px] text-ink-soft">
          No terms defined yet.{" "}
          <Link href="/admin/terms" className="text-brand-ink font-semibold hover:underline">
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
  const bookletSignedUrl = selectedWeek
    ? await signCurriculumUrl(selectedWeek.bookletUrl)
    : null;

  const [weekQuiz, tutorRows] = await Promise.all([
    selectedWeek
      ? db
          .select({
            id: quizzes.id,
            title: quizzes.title,
            status: quizzes.status,
            questionCount: sql<number>`(
              select count(*)::int from ${quizQuestions}
              where ${quizQuestions.quizId} = ${quizzes.id}
                and ${quizQuestions.type} <> 'context'
            )`,
          })
          .from(quizzes)
          .where(eq(quizzes.subjectWeekId, selectedWeek.id))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .where(and(eq(profiles.role, "tutor"), eq(profiles.isActive, true)))
      .orderBy(asc(profiles.firstName), asc(profiles.lastName)),
  ]);

  const topicNameById = new Map(topics.map((t) => [t.id, t.name]));
  const railWeeks: RailWeek[] = weeks.map((w) => ({
    id: w.id,
    weekNumber: w.weekNumber,
    title: w.title,
    topicId: w.topicId,
    topicName: w.topicId ? (topicNameById.get(w.topicId) ?? null) : null,
  }));

  return (
    <div className="-mx-5 -mt-6 -mb-6 flex min-h-[calc(100vh-56px)] flex-col lg:-mx-7 lg:-mb-16">
      <h1 className="sr-only">{subject.name} - Curriculum</h1>

      <CurriculumLayout
        attached
        subjectName={subject.name}
        flushTabTop
        rail={
          <CurriculumRail
            basePath={`/admin/subjects/${subjectId}/curriculum`}
            currentTermId={currentTerm.id}
            terms={allTerms.map((t) => ({
              id: t.id,
              label: `${t.year} · Term ${t.termNumber}`,
            }))}
            weeks={railWeeks}
            selectedWeekId={selectedWeek?.id ?? null}
            footer={
              <Link
                href={`/admin/subjects/${subjectId}/curriculum?term=${currentTerm.id}&new=1`}
                className="mt-1.5 block rounded-[12px] border border-dashed border-brand-300 bg-brand-50/40 px-3 py-2.5 text-center text-[13px] font-bold text-brand-700 transition-colors hover:border-brand-400 hover:bg-brand-100"
              >
                + Add week
              </Link>
            }
          />
        }
      >
        {isNew || !selectedWeek ? (
          <WeekEditor
            subjectId={subjectId}
            termId={currentTerm.id}
            topics={topics}
            subjectName={subject.name}
            weekCounts={weekCounts}
            quiz={null}
            quizTutors={tutorRows.map((tutor) => ({
              id: tutor.id,
              name: `${tutor.firstName} ${tutor.lastName ?? ""}`.trim(),
            }))}
          />
        ) : (
          <WeekEditor
            existing={selectedWeek}
            subjectId={subjectId}
            termId={currentTerm.id}
            topics={topics}
            subjectName={subject.name}
            weekCounts={weekCounts}
            quiz={weekQuiz}
            bookletSignedUrl={bookletSignedUrl}
            quizTutors={tutorRows.map((tutor) => ({
              id: tutor.id,
              name: `${tutor.firstName} ${tutor.lastName ?? ""}`.trim(),
            }))}
            quizTarget={{
              id: selectedWeek.id,
              label: `${subject.name} - ${currentTerm.year} Term ${currentTerm.termNumber}, Week ${selectedWeek.weekNumber}`,
              subjectName: subject.name,
              weekLabel: `${currentTerm.year} Term ${currentTerm.termNumber}, Week ${selectedWeek.weekNumber}`,
            }}
          />
        )}
      </CurriculumLayout>
    </div>
  );
}
