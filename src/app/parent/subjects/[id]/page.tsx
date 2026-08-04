import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { resolveSelectedChild } from "@/app/parent/_data";
import { currentWeekNumber } from "@/lib/curriculum";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { getParentCurriculum } from "./_queries";
import { WeekStrip } from "@/components/subjects/week-strip";
import { WeekContentParent } from "./_components/week-content";

type SearchParams = Promise<{ child?: string; term?: string; week?: string }>;

export default async function ParentSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const user = await requireRole("parent");
  const { id: subjectId } = await params;
  const { child, term, week } = await searchParams;

  const resolved = await resolveSelectedChild(user.id, child);
  if (!resolved.selected) notFound();

  const data = await getParentCurriculum(
    user.id,
    resolved.selected.id,
    subjectId,
    term,
  );
  if (!data) notFound();

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

  const selected =
    data.weeks.find((w) => w.subjectWeekId === week) ??
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

  return (
    <div className="space-y-6">
      <Link
        href={`/parent?child=${resolved.selected.id}`}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-bold text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← Overview
      </Link>

      <Card>
        <div className="px-6 py-5 border-b border-line">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted">
            {data.childFirstName}
          </div>
          <h1 className="mt-1.5 text-2xl lg:text-3xl font-extrabold tracking-[-0.02em] text-ink truncate">
            {data.subjectName}
          </h1>
          <p className="text-sm text-muted mt-1 truncate">
            {data.className} · {data.currentTerm.year} · Term{" "}
            {data.currentTerm.termNumber}
          </p>
        </div>

        {data.lessonPlan && (
          <div className="px-6 py-5 border-b border-line bg-brand-50/60">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-brand-700">
              What's coming up
            </div>
            <p className="mt-2 text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">
              {data.lessonPlan}
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6 p-6">
          <WeekStrip
            basePath={`/parent/subjects/${subjectId}`}
            childId={resolved.selected.id}
            currentTermId={data.currentTerm.id}
            termsAvailable={data.termsAvailable}
            weeks={weekStripItems}
            selectedWeekId={selected?.subjectWeekId ?? null}
            currentWeekIdHint={currentWeekHint}
            accent={getAccentTokens(colorFamilyForSubject(data.subjectName))}
          />
          <div className="lg:border-l lg:border-line lg:pl-6">
            {selected && <WeekContentParent week={selected} />}
          </div>
        </div>
      </Card>
    </div>
  );
}
