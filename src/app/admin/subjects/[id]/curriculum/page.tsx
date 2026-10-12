import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  Empty,
  PageHeader,
  SubjectDot,
  buttonVariants,
} from "@/components/admin/ui";
import { GlassPanel } from "@/components/admin/ui/glass-panel";
import { db } from "@/db/client";
import {
  classes,
  homework,
  profiles,
  quizzes,
  subjectWeeks,
  subjects,
  terms,
  subjectTopics,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { resolveCurrentTerm } from "@/lib/curriculum";
import { signCurriculumUrl } from "@/lib/curriculum-storage";
import { signHomeworkAttachment } from "@/app/student/homework/_storage";
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
      <div className="flex flex-col gap-5">
        <PageHeader
          back={{ href: "/admin/classes", label: "Back to classes" }}
          eyebrow={
            <>
              <SubjectDot subject={subject.name} />
              Curriculum
            </>
          }
          title={subject.name}
        />
        <GlassPanel>
          <Empty className="flex flex-col items-center gap-4">
            No terms yet. Add a term to start planning weeks.
            <Link
              href="/admin/terms"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Add a term
            </Link>
          </Empty>
        </GlassPanel>
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
  const videoSignedUrl = selectedWeek
    ? await signCurriculumUrl(selectedWeek.videoUrl)
    : null;

  const [weekQuiz, tutorRows, classRows, weekHomeworkRows] = await Promise.all([
    selectedWeek
      ? db
          .select({
            id: quizzes.id,
            title: quizzes.title,
            status: quizzes.status,
            questionCount: sql<number>`(
              select count(*)::int from quiz_questions qq
              where qq.quiz_id = quizzes.id and qq.type <> 'context'
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
    db
      .select({
        id: classes.id,
        name: classes.name,
        tutorFirstName: profiles.firstName,
        tutorLastName: profiles.lastName,
      })
      .from(classes)
      .innerJoin(profiles, eq(profiles.id, classes.tutorId))
      .where(eq(classes.subjectId, subjectId))
      .orderBy(asc(classes.name)),
    selectedWeek
      ? db
          .select({
            id: homework.id,
            title: homework.title,
            dueDate: homework.dueDate,
            attachmentUrl: homework.attachmentUrl,
            solutionUrl: homework.solutionUrl,
            classId: homework.classId,
            className: classes.name,
          })
          .from(homework)
          .leftJoin(classes, eq(classes.id, homework.classId))
          .where(eq(homework.weekId, selectedWeek.id))
          .orderBy(asc(homework.dueDate))
      : Promise.resolve([]),
  ]);

  const weekHomework = await Promise.all(
    weekHomeworkRows.map(async (item) => {
      const [attachmentHref, solutionHref] = await Promise.all([
        signHomeworkAttachment(item.attachmentUrl),
        signHomeworkAttachment(item.solutionUrl),
      ]);
      return { ...item, attachmentHref, solutionHref };
    }),
  );

  const topicNameById = new Map(topics.map((t) => [t.id, t.name]));
  const railWeeks: RailWeek[] = weeks.map((w) => ({
    id: w.id,
    weekNumber: w.weekNumber,
    title: w.title,
    topicId: w.topicId,
    topicName: w.topicId ? (topicNameById.get(w.topicId) ?? null) : null,
  }));

  return (
    <div className="flex flex-col">
      <CurriculumLayout
        attached
        framed
        subjectName={subject.name}
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
                className="flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong bg-surface text-[13px] font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add week
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
            homeworkClasses={classRows.map((row) => ({
              id: row.id,
              label: `${row.name} - ${row.tutorFirstName} ${row.tutorLastName}`.trim(),
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
            videoSignedUrl={videoSignedUrl}
            quizTutors={tutorRows.map((tutor) => ({
              id: tutor.id,
              name: `${tutor.firstName} ${tutor.lastName ?? ""}`.trim(),
            }))}
            homeworkClasses={classRows.map((row) => ({
              id: row.id,
              label: `${row.name} - ${row.tutorFirstName} ${row.tutorLastName}`.trim(),
            }))}
            homework={weekHomework}
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
