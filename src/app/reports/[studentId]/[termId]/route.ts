import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { familyLinks, termReportIssues } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { coarseRole, isUnrestrictedStudent } from "@/lib/roles";
import { getStudentTermReport } from "@/lib/student-report";
import { StudentReportPdf } from "@/lib/pdf/student-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isParentOf(parentId: string, studentId: string): Promise<boolean> {
  const [row] = await db
    .select({ studentId: familyLinks.studentId })
    .from(familyLinks)
    .where(
      and(
        eq(familyLinks.parentId, parentId),
        eq(familyLinks.studentId, studentId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Has an admin sent this student's report for this term? */
async function isSent(studentId: string, termId: string): Promise<boolean> {
  const [row] = await db
    .select({ studentId: termReportIssues.studentId })
    .from(termReportIssues)
    .where(and(eq(termReportIssues.studentId, studentId), eq(termReportIssues.termId, termId)))
    .limit(1);
  return Boolean(row);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Downloadable student term report PDF. Access is role-aware:
 *  - any admin, always (they review it before sending);
 *  - the student themselves, but only if unrestricted (student_restricted
 *    cannot view their own report, per the visibility gate);
 *  - a parent of the student.
 * Anyone else gets 403. A student or parent gets it only once an admin has
 * sent it: until then it can hold comments a tutor is still writing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string; termId: string }> },
) {
  const { studentId, termId } = await params;
  if (!UUID.test(studentId) || !UUID.test(termId)) {
    return new NextResponse("Report not found", { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const role = user.app_metadata?.role as UserRole | undefined;
  if (!role) return new NextResponse("Forbidden", { status: 403 });
  const coarse = coarseRole(role);

  let allowed = false;
  if (coarse === "admin") {
    allowed = true;
  } else if (coarse === "student") {
    allowed = user.id === studentId && isUnrestrictedStudent(role);
  } else if (coarse === "parent") {
    allowed = await isParentOf(user.id, studentId);
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });
  if (coarse !== "admin" && !(await isSent(studentId, termId))) {
    return new NextResponse("Report not found", { status: 404 });
  }

  const report = await getStudentTermReport(studentId, termId);
  if (!report) return new NextResponse("Report not found", { status: 404 });

  const generatedAtLabel = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const buffer = await renderToBuffer(
    StudentReportPdf({ report, generatedAtLabel }),
  );

  const nameSlug = `${report.student.firstName}-${report.student.lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${nameSlug}-${report.term.year}-t${report.term.termNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
