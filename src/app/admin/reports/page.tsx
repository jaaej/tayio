import Link from "next/link";
import { Download } from "lucide-react";
import { Card, CardHead, StatTile, PageHeader, Pill, Empty } from "@/components/admin/ui";
import { requireAdmin } from "@/app/admin/_lib/guard";
import {
  listTerms,
  getCurrentTermId,
  getClassMetricRows,
} from "@/app/admin/_lib/reports-queries";
import { toClassReportRow, rollupOrgWide } from "@/app/admin/_lib/reports-metrics";
import { TermSelect } from "./_components/term-select";

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function score(value: number | null): string {
  return value === null ? "—" : String(value);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  await requireAdmin();
  const { term: termParam } = await searchParams;

  const terms = await listTerms();
  if (terms.length === 0) {
    return (
      <div className="space-y-6 max-w-[1400px]">
        <PageHeader eyebrow="Reports" title="Operational reports" />
        <Card>
          <Empty>No terms defined yet. Create a term to see reports.</Empty>
        </Card>
      </div>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentTermId = await getCurrentTermId(todayIso);
  const selected =
    terms.find((t) => t.id === termParam) ??
    terms.find((t) => t.id === currentTermId) ??
    terms[0];

  const metricRows = await getClassMetricRows(selected);
  const rows = metricRows.map(toClassReportRow);
  const org = rollupOrgWide(metricRows);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        eyebrow="Reports"
        title="Operational reports"
        sub="Attendance, homework completion, and class fill for the selected term."
        actions={
          <div className="flex items-center gap-3">
            <TermSelect terms={terms} selectedId={selected.id} />
            <Link
              href={`/admin/reports/export?term=${selected.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-bold text-ink hover:bg-surface-2 transition-colors"
            >
              <Download className="h-4 w-4" /> CSV
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Attendance" value={pct(org.attendancePct)} tone="brand" accent />
        <StatTile label="Homework completion" value={pct(org.homeworkPct)} tone="sky" accent />
        <StatTile label="Class fill (now)" value={pct(org.fillPct)} tone="mint" accent />
      </section>

      <Card>
        <CardHead
          title="By class"
          action={<Pill tone="default">{rows.length} classes</Pill>}
        />
        {rows.length === 0 ? (
          <Empty>No classes to report on for this term.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="px-5 py-2.5 font-bold">Class</th>
                  <th className="px-5 py-2.5 font-bold">Tutor</th>
                  <th className="px-5 py-2.5 font-bold text-right">Attendance</th>
                  <th className="px-5 py-2.5 font-bold text-right">Homework</th>
                  <th className="px-5 py-2.5 font-bold text-right">Avg test</th>
                  <th className="px-5 py-2.5 font-bold text-right">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.classId} className="hover:bg-surface-2 transition-colors">
                    <td className="px-5 py-3 font-bold text-ink">{r.className}</td>
                    <td className="px-5 py-3 text-ink-soft">{r.tutorName}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{pct(r.attendancePct)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{pct(r.homeworkPct)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{score(r.avgTestResult)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {r.enrolled}/{r.capacity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
