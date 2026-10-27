import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { MAX_DOC_BYTES, markupDocSchema, type MarkupDoc } from "@/lib/markup/doc";
import { saveMarkup } from "@/lib/markup/store";
import { markupTargetSchema, resolveMarkupTarget, viewerFromUser } from "@/lib/markup/targets";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  target: markupTargetSchema,
  fileVersion: z.string().max(200),
  baseVersion: z.number().int().min(0),
  doc: markupDocSchema,
});

/**
 * Saves what the signed-in user wrote on a file. A route rather than a
 * server action so the viewer can still save with `fetch(..., { keepalive })`
 * while the page is closing. 409 when the marks were saved from somewhere
 * else since the writer opened them; the body carries the current version.
 */
export async function POST(request: NextRequest) {
  // Same-origin only: the viewer is the only caller.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
  }
  const viewer = viewerFromUser(await getCurrentUser());
  if (!viewer) return NextResponse.json({ ok: false, error: "Sign in again to save." }, { status: 401 });

  const allowed = await rateLimit({ bucket: "markup-save", identifier: viewer.id, max: 240, windowSeconds: 120 });
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Saving too often. Try again in a minute." }, { status: 429 });
  }

  const raw = await request.text();
  if (raw.length > MAX_DOC_BYTES) {
    return NextResponse.json({ ok: false, error: "There is too much on this file to save." }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the save." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Could not read the save." }, { status: 400 });
  }
  const { target, fileVersion, baseVersion, doc } = parsed.data;

  const resolved = await resolveMarkupTarget(viewer, target);
  if (!resolved?.edit) {
    return NextResponse.json({ ok: false, error: "You can't write on this file." }, { status: 403 });
  }

  const result = await saveMarkup(
    resolved.edit,
    { bucket: resolved.file.bucket, path: resolved.file.path, version: fileVersion },
    doc as MarkupDoc,
    baseVersion,
    viewer.id,
  );
  return result.ok
    ? NextResponse.json({ ok: true, version: result.version })
    : NextResponse.json({ ok: false, conflict: true, version: result.version }, { status: 409 });
}
