import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { db } from "@/db/client";
import { homework } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { recordSubmission, storeSubmissionFile } from "@/lib/homework-submission";
import { FlattenError, flattenMarkup } from "@/lib/markup/flatten";
import { loadMarkup } from "@/lib/markup/store";
import { resolveMarkupTarget, storedFileVersion, viewerFromUser } from "@/lib/markup/targets";
import { rateLimit } from "@/lib/rate-limit";
import { coarseRole } from "@/lib/roles";

export const runtime = "nodejs";
// Drawing the marks into a long PDF can take a few seconds.
export const maxDuration = 60;

/** The worksheet the marks are drawn on; tutors upload far smaller files. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

const bodySchema = z.object({ fileVersion: z.string().max(200) });

/**
 * "Submit this file": hands in the homework's worksheet with what the
 * student wrote on it in the viewer, drawn into one PDF, so they don't
 * have to download it, write on it elsewhere and upload it again. The viewer
 * saves the marks before calling this; what is submitted is what was saved.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
  }
  const { id: homeworkId } = await ctx.params;
  const viewer = viewerFromUser(await getCurrentUser());
  if (!viewer || coarseRole(viewer.role) !== "student") {
    return NextResponse.json({ ok: false, error: "Sign in again to submit." }, { status: 401 });
  }
  if (!z.string().uuid().safeParse(homeworkId).success) {
    return NextResponse.json({ ok: false, error: "Assignment not found." }, { status: 404 });
  }
  const allowed = await rateLimit({ bucket: "markup-submit", identifier: viewer.id, max: 10, windowSeconds: 600 });
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Too many tries. Wait a few minutes and submit again." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Could not read the request." }, { status: 400 });

  const resolved = await resolveMarkupTarget(viewer, { kind: "homework-sheet", homeworkId, sheet: "worksheet" });
  if (!resolved?.edit) return NextResponse.json({ ok: false, error: "Assignment not found." }, { status: 404 });
  if (!resolved.canSubmit) {
    return NextResponse.json({ ok: false, error: "This homework can't be submitted now." }, { status: 409 });
  }

  const { bucket, path, kind } = resolved.file;
  const currentVersion = await storedFileVersion(bucket, path);
  if (currentVersion !== parsed.data.fileVersion) {
    return NextResponse.json(
      { ok: false, error: "Your tutor replaced this worksheet while you had it open. Close it and open it again." },
      { status: 409 },
    );
  }
  const { doc } = await loadMarkup(resolved.edit, { bucket, path, version: currentVersion });
  if (doc.items.length === 0) {
    return NextResponse.json({ ok: false, error: "Write on the worksheet before submitting it." }, { status: 400 });
  }

  const { data: blob, error: downloadError } = await createAdminClient().storage.from(bucket).download(path);
  if (downloadError || !blob) {
    console.error("[submit-markup] worksheet download failed", { homeworkId, message: downloadError?.message });
    return NextResponse.json({ ok: false, error: "The worksheet couldn't be loaded. Try again." }, { status: 502 });
  }
  if (blob.size > MAX_SOURCE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "This worksheet is too large to submit from here. Download it and upload your work instead." },
      { status: 413 },
    );
  }

  let pdf: Uint8Array;
  try {
    pdf = await flattenMarkup(new Uint8Array(await blob.arrayBuffer()), kind, doc);
  } catch (error) {
    if (error instanceof FlattenError) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    console.error("[submit-markup] flatten failed", { homeworkId, error });
    return NextResponse.json(
      { ok: false, error: "Your writing couldn't be added to this file. Download it and upload your work instead." },
      { status: 500 },
    );
  }

  const [hw] = await db.select({ title: homework.title }).from(homework).where(eq(homework.id, homeworkId)).limit(1);
  const stored = await storeSubmissionFile(viewer.id, homeworkId, `${hw?.title ?? "Homework"}.pdf`, pdf, "application/pdf");
  if (!stored) return NextResponse.json({ ok: false, error: "The upload didn't go through. Try again." }, { status: 502 });

  const recorded = await recordSubmission(homeworkId, viewer.id, { path: stored, text: null });
  if (!recorded.ok) return NextResponse.json({ ok: false, error: recorded.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}
