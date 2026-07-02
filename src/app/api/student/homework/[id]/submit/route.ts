import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { homework, homeworkAssignments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HOMEWORK_BUCKET } from "@/app/student/homework/_storage";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const SAFE_NAME = /[^a-zA-Z0-9._-]/g;

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: homeworkId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  // app_metadata only — user_metadata is user-mutable and must not gate access.
  const role = user.app_metadata?.role as string | undefined;
  if (role !== "student") {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const detailUrl = new URL(`/student/homework/${homeworkId}`, request.url);

  // Confirm the assignment exists for this student.
  const existing = await db
    .select({
      status: homeworkAssignments.status,
      dueDate: homework.dueDate,
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

  const { status, dueDate, allowResubmission } = existing[0];
  const alreadySubmitted = status === "submitted" || status === "marked" || status === "returned";
  if (alreadySubmitted && !allowResubmission) {
    return failRedirect(detailUrl, "Resubmission isn't allowed for this homework.");
  }

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
    if (file.size > MAX_FILE_BYTES) {
      return failRedirect(detailUrl, "File too large (10 MB max).");
    }
    const safeName = file.name.replace(SAFE_NAME, "_") || "submission";
    const stamp = Date.now();
    submissionPath = `${user.id}/${homeworkId}/${stamp}-${safeName}`;

    const supabase = await createClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from(HOMEWORK_BUCKET)
      .upload(submissionPath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadErr) {
      return failRedirect(detailUrl, `Upload failed: ${uploadErr.message}`);
    }
  }

  const now = new Date();
  const isLate = now > dueDate;

  await db
    .update(homeworkAssignments)
    .set({
      status: isLate ? "late" : "submitted",
      submittedAt: now,
      ...(submissionPath ? { submissionUrl: submissionPath } : {}),
      ...(text ? { submissionText: text } : {}),
    })
    .where(
      and(
        eq(homeworkAssignments.homeworkId, homeworkId),
        eq(homeworkAssignments.studentId, user.id),
      ),
    );

  const successUrl = new URL(detailUrl);
  successUrl.searchParams.set("submitted", "1");
  return NextResponse.redirect(successUrl, 303);
}

function failRedirect(detailUrl: URL, message: string) {
  const url = new URL(detailUrl);
  url.searchParams.set("error", encodeURIComponent(message));
  return NextResponse.redirect(url, 303);
}
