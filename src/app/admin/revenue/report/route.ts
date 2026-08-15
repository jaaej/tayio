import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole } from "@/lib/auth";
import { isUnrestrictedAdmin } from "@/lib/roles";
import type { UserRole } from "@/db/schema";
import { getAdminSecurityState } from "@/app/admin/_lib/actions-security";
import { getFinancialReport } from "@/app/admin/_lib/queries";
import { FinancialReportPdf } from "@/lib/pdf/financial-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parse a YYYY-MM-DD param into a local-midnight Date, or null. */
function parseLocalDate(v: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  // Same gate as the revenue page: the owner always sees figures; reception
  // (admin_restricted) only after unlocking the PIN this session.
  const user = await requireRole("admin");
  const owner = isUnrestrictedAdmin(
    user.app_metadata?.role as UserRole | undefined,
  );
  const { unlocked } = await getAdminSecurityState();
  if (!owner && !unlocked) {
    return NextResponse.redirect(new URL("/admin/revenue", req.url));
  }

  const params = req.nextUrl.searchParams;
  const now = new Date();
  // Default range: the current calendar month.
  const from =
    parseLocalDate(params.get("from")) ??
    new Date(now.getFullYear(), now.getMonth(), 1);
  // `to` from the client is the inclusive last day; convert to an exclusive
  // bound (start of the next day). Default: start of next month.
  const toInclusive = parseLocalDate(params.get("to"));
  const toExclusive = toInclusive
    ? new Date(
        toInclusive.getFullYear(),
        toInclusive.getMonth(),
        toInclusive.getDate() + 1,
      )
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (toExclusive <= from) {
    return NextResponse.json(
      { error: "End date must be on or after the start date." },
      { status: 400 },
    );
  }

  const report = await getFinancialReport(from, toExclusive);
  const generatedAtLabel = now.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const buffer = await renderToBuffer(
    FinancialReportPdf({ report, generatedAtLabel }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="financial-report-${report.fromIso}-to-${report.toIso}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
