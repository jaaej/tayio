import { type NextRequest } from "next/server";
import { requireAdmin } from "@/app/admin/_lib/guard";
import { listTerms, getClassMetricRows } from "@/app/admin/_lib/reports-queries";
import { toClassReportRow } from "@/app/admin/_lib/reports-metrics";
import { classReportToCsv } from "@/app/admin/_lib/reports-csv";

export async function GET(req: NextRequest) {
  await requireAdmin();

  const termId = req.nextUrl.searchParams.get("term");
  const terms = await listTerms();
  const term = terms.find((t) => t.id === termId) ?? terms[0];
  if (!term) {
    return new Response("No term available", { status: 400 });
  }

  const rows = (await getClassMetricRows(term)).map(toClassReportRow);
  const csv = classReportToCsv(rows);
  const filename = `operational-report-${term.label.replace(/\s+/g, "-")}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
