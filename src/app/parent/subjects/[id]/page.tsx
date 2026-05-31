import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { resolveSelectedChild } from "@/app/parent/_data";
import { currentWeekNumber } from "@/lib/curriculum";
import { getParentCurriculum } from "./_queries";
import { WeekStripParent } from "./_components/week-strip";
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
        className="inline-flex items-center gap-2 rounded-lg border border-hairline/60 bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:border-brand-300 transition-colors"
      >
        ← Overview
      </Link>

      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-hairline/60 bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100">
          <h1 className="text-3xl lg:text-4xl font-medium tracking-tight text-ink truncate">
            {data.subjectName} — {data.childFirstName}
          </h1>
          <p className="text-sm text-ink-soft mt-1 truncate">
            {data.className} · {data.currentTerm.year} · Term{" "}
            {data.currentTerm.termNumber}
          </p>
        </div>

        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-6 p-6">
          <WeekStripParent
            subjectId={subjectId}
            childId={resolved.selected.id}
            currentTermId={data.currentTerm.id}
            termsAvailable={data.termsAvailable}
            weeks={weekStripItems}
            selectedWeekId={selected?.subjectWeekId ?? null}
            currentWeekIdHint={currentWeekHint}
          />
          <div className="lg:border-l lg:border-hairline/60 lg:pl-6">
            {selected && <WeekContentParent week={selected} />}
          </div>
        </div>
      </Card>
    </div>
  );
}
