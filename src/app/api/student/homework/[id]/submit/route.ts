import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { homework, homeworkAssignments, type UserRole } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { coarseRole } from "@/lib/roles";
import { recordSubmission, storeSubmissionFile, submissionClosedReason } from "@/lib/homework-submission";
import { SUBMISSION_POLICY, typeFromFileName, validateUpload } from "@/lib/upload-validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: homeworkId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  // app_metadata only - user_metadata is user-mutable and must not gate access.
  const role = user.app_metadata?.role as string | undefined;
  if (!role || coarseRole(role as UserRole) !== "student") {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const detailUrl = new URL(`/student/homework/${homeworkId}`, request.url);

  // Confirm the assignment exists for this student.
  const existing = await db
    .select({
      status: homeworkAssignments.status,
      allowResubmission: homework.allowResubmission,
    })
    .from(homeworkAssignments)
    .innerJoin(homework, eq(homework.id, homeworkAssignments.homeworkId))
    .where(
      and(
        eq(homeworkAssignments.homeworkId, homeworkId),
        eq(homeworkAssignments.studentId, user.id),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    return failRedirect(detailUrl, "Assignment not found.");
  }

  const { status, allowResubmission } = existing[0];
  const closed = submissionClosedReason(status, allowResubmission);
  if (closed) return failRedirect(detailUrl, closed);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failRedirect(detailUrl, "Could not read the upload. Try again.");
  }

  const fileField = formData.get("file");
  const textField = formData.get("text");
  const text = typeof textField === "string" ? textField.trim() : "";
  const file = fileField instanceof File && fileField.size > 0 ? fileField : null;

  if (!file && !text) {
    return failRedirect(detailUrl, "Upload a file or type an answer first.");
  }

  let submissionPath: string | null = null;

  if (file) {
    if (file.size > SUBMISSION_POLICY.maxBytes) {
      return failRedirect(detailUrl, "File too large (10 MB max).");
    }
    // A browser that doesn't know the file sends it untyped; its extension then says what it claims to be.
    const untyped = !file.type || file.type === "application/octet-stream";
    const declared = untyped ? typeFromFileName(file.name, SUBMISSION_POLICY) : file.type;
    const checked = await validateUpload(new Blob([file], { type: declared ?? "" }), SUBMISSION_POLICY);
    if (!checked.ok) {
      return failRedirect(detailUrl, "Upload a PDF, photo, Word document or text file.");
    }
    // The stored name keeps the student's own name, with the extension its content proved.
    const baseName = file.name.replace(/\.[^.]*$/, "") || "submission";
    submissionPath = await storeSubmissionFile(
      user.id,
      homeworkId,
      `${baseName}.${checked.file.ext}`,
      new Uint8Array(await file.arrayBuffer()),
      checked.file.contentType,
    );
    if (!submissionPath) return failRedirect(detailUrl, "The upload didn't go through. Try again.");
  }

  const recorded = await recordSubmission(homeworkId, user.id, { path: submissionPath, text: text || null });
  if (!recorded.ok) return failRedirect(detailUrl, recorded.error);

  const successUrl = new URL(detailUrl);
  successUrl.searchParams.set("submitted", "1");
  return NextResponse.redirect(successUrl, 303);
}

function failRedirect(detailUrl: URL, message: string) {
  const url = new URL(detailUrl);
  url.searchParams.set("error", encodeURIComponent(message));
  return NextResponse.redirect(url, 303);
}
