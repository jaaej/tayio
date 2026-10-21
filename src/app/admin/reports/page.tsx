import Link from "next/link";
import { Download } from "lucide-react";
import { formatScore } from "@/lib/format";
import { melbourneDate } from "@/lib/tutor-cover-rules";
import {
  Empty,
  GlassPanel,
  MetricTile,
  PageHeader,
  SegmentedLinks,
  SubjectDot,
  buttonVariants,
} from "@/components/admin/ui";
import { requireAdmin } from "@/app/admin/_lib/guard";
import { getReportProgress } from "@/lib/term-report-entries";
import {
  listTerms,
  getCurrentTermId,
  getClassMetricRows,
} from "@/app/admin/_lib/reports-queries";
import { toClassReportRow, rollupOrgWide } from "@/app/admin/_lib/reports-metrics";
import { classEditHref } from "@/app/admin/_lib/class-links";
import { getTermReportClasses, getTermReportRoster } from "@/app/admin/_lib/term-reports";
import { TermSelect } from "./_components/term-select";
import { TermReportsPanel } from "./_components/term-reports-panel";

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  return value === null ? "-" : `${value}%`;
}

function score(value: number | null): string {
  return value === null ? "-" : formatScore(value);
}

/** Meter fill: strong at 90%+, ink in the normal band, amber below 75%. */
function meterColour(value: number) {
  if (value >= 90) return "#16A34A";
  if (value >= 75) return "#17152B";
  return "#E8890C";
}

function Meter({ value, height = 6 }: { value: number | null; height?: number }) {
  return (
    <span
      aria-hidden
      className="block w-full overflow-hidden rounded-full bg-surface-3"
      style={{ height }}
    >
      {value !== null && (
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: meterColour(value) }}
        />
      )}
    </span>
  );
}

function RateCell({ value }: { value: number | null }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex-1">
        <Meter value={value} />
      </span>
      <span className="w-10 text-right font-bold">{pct(value)}</span>
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; view?: string; class?: string }>;
}) {
  await requireAdmin();
  const { term: termParam, view: viewParam, class: classParam } = await searchParams;
  const view = viewParam === "term-reports" ? "term-reports" : "classes";

  const terms = await listTerms();
  if (terms.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Reports" />
        <GlassPanel>
          <Empty>
            <p>No terms defined yet. Create a term to see reports.</p>
            <Link
              href="/admin/terms"
              className={`${buttonVariants({ variant: "outline", size: "md" })} mt-3`}
            >
              Set up terms
            </Link>
          </Empty>
        </GlassPanel>
      </div>
    );
  }

  const todayIso = melbourneDate(new Date());
  const currentTermId = await getCurrentTermId(todayIso);
  const selected =
    terms.find((t) => t.id === termParam) ??
    terms.find((t) => t.id === currentTermId) ??
    terms[0];

  const viewLinks = (
    <SegmentedLinks
      label="Report"
      size="md"
      items={[
        {
          label: "Classes",
          href: `/admin/reports?term=${selected.id}`,
          active: view === "classes",
        },
        {
          label: "Term reports",
          href: `/admin/reports?term=${selected.id}&view=term-reports`,
          active: view === "term-reports",
        },
      ]}
    />
  );

  if (view === "term-reports") {
    const reportClasses = await getTermReportClasses(selected);
    const classId =
      reportClasses.find((c) => c.id === classParam)?.id ?? reportClasses[0]?.id ?? null;
    const roster = classId ? await getTermReportRoster(selected, classId) : [];
    // How much of each student's whole report their tutors have written.
    const progress = await getReportProgress(selected, roster.map((s) => s.id));
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Reports"
          actions={
            <>
              {viewLinks}
              <TermSelect terms={terms} selectedId={selected.id} />
            </>
          }
        />
        <TermReportsPanel
          termId={selected.id}
          classes={reportClasses}
          classId={classId}
          roster={roster.map((s) => ({
            ...s,
            written: progress.get(s.id)?.written ?? 0,
            subjects: progress.get(s.id)?.total ?? 0,
          }))}
        />
      </div>
    );
  }

  const metricRows = await getClassMetricRows(selected);
  const rows = metricRows.map(toClassReportRow);
  const org = rollupOrgWide(metricRows);
  const sum = (pick: (r: (typeof metricRows)[number]) => number) =>
    metricRows.reduce((acc, r) => acc + pick(r), 0);

  const tiles = [
    {
      label: "Attendance",
      value: org.attendancePct,
      detail: `${sum((r) => r.attended)} of ${sum((r) => r.markedLessons)} marked`,
    },
    {
      label: "Homework completion",
      value: org.homeworkPct,
      detail: `${sum((r) => r.homeworkCompleted)} of ${sum((r) => r.homeworkAssigned)} tasks`,
    },
    {
      label: "Class fill (now)",
      value: org.fillPct,
      detail: `${sum((r) => r.enrolled)} of ${sum((r) => r.capacity)} seats`,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reports"
        actions={
          <>
            {viewLinks}
            <TermSelect terms={terms} selectedId={selected.id} />
            <Link
              href={`/admin/reports/export?term=${selected.id}`}
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              <Download className="h-[15px] w-[15px]" strokeWidth={2.2} aria-hidden />
              Export CSV
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <MetricTile
            key={tile.label}
            label={tile.label}
            value={pct(tile.value)}
            sub={
              <span className="flex flex-col gap-2.5">
                <span className="font-semibold">{tile.detail}</span>
                <Meter value={tile.value} height={8} />
              </span>
            }
          />
        ))}
      </div>

      <GlassPanel
        title="By class"
        titleId="reports-by-class"
        meta={`${rows.length} ${rows.length === 1 ? "class" : "classes"}`}
      >
        {rows.length === 0 ? (
          <Empty>No classes to report on for this term.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-muted">
                  <th scope="col" className="px-4 py-3 font-extrabold">Class</th>
                  <th scope="col" className="px-2.5 py-3 font-extrabold">Tutor</th>
                  <th scope="col" className="w-[150px] px-2.5 py-3 font-extrabold">Attendance</th>
                  <th scope="col" className="w-[150px] px-2.5 py-3 font-extrabold">Homework</th>
                  <th scope="col" className="px-2.5 py-3 text-right font-extrabold">Avg test</th>
                  <th scope="col" className="px-4 py-3 text-right font-extrabold">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.classId}
                    className="border-t border-line tabular-nums transition-colors hover:bg-[#F8F9FC]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={classEditHref(r.subjectId, r.classId)}
                        className="flex items-center gap-2 font-bold text-ink hover:text-brand-600"
                      >
                        <SubjectDot subject={r.subjectName} color={r.subjectColor} />
                        {r.className}
                      </Link>
                    </td>
                    <td className="px-2.5 py-3 text-ink-soft">{r.tutorName}</td>
                    <td className="px-2.5 py-3">
                      <RateCell value={r.attendancePct} />
                    </td>
                    <td className="px-2.5 py-3">
                      <RateCell value={r.homeworkPct} />
                    </td>
                    <td className="px-2.5 py-3 text-right font-bold">{score(r.avgTestResult)}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {r.enrolled}/{r.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
