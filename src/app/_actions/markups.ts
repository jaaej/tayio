"use server";

import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { getCurrentUser } from "@/lib/auth";
import type { MarkupDoc } from "@/lib/markup/doc";
import { hasMarkupOnOlderFile, loadMarkup } from "@/lib/markup/store";
import {
  markupTargetSchema,
  resolveMarkupTarget,
  storedFileVersion,
  viewerFromUser,
} from "@/lib/markup/targets";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type OpenedMarkup =
  | {
      ok: true;
      fileUrl: string;
      downloadUrl: string | null;
      fileKind: "pdf" | "image";
      /** Sent back with every save, so marks stay with this version of the file. */
      fileVersion: string;
      /** The viewer's own layer, when they may write. */
      editable: { doc: MarkupDoc; version: number } | null;
      /** Other people's marks, shown read only (a tutor's marking). */
      overlays: MarkupDoc[];
      canSubmit: boolean;
      defaultPen: "ink" | "red";
      /** The file was replaced since this person last wrote on it. */
      replaced: boolean;
    }
  | { ok: false; error: string };

/**
 * Opens a file in the portal's viewer for writing on (or for seeing a
 * tutor's marks): checks the viewer may, signs the file, and loads the
 * marks. See `resolveMarkupTarget` for who may do what.
 */
export async function openMarkup(input: unknown): Promise<OpenedMarkup> {
  const viewer = viewerFromUser(await getCurrentUser());
  if (!viewer) return { ok: false, error: "Sign in again to open this file." };
  const parsed = markupTargetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This file could not be found." };
  const resolved = await resolveMarkupTarget(viewer, parsed.data);
  if (!resolved) return { ok: false, error: "This file could not be found." };

  const { bucket, path, kind, downloadName } = resolved.file;
  const storage = createAdminClient().storage.from(bucket);
  const [view, download, version] = await Promise.all([
    storage.createSignedUrl(path, SIGNED_URL_TTL_SECONDS),
    storage.createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: downloadName }),
    storedFileVersion(bucket, path),
  ]);
  if (!view.data?.signedUrl) return { ok: false, error: "This file could not be opened. Try again." };

  const file = { bucket, path, version };
  const [editable, overlays, replaced] = await Promise.all([
    resolved.edit ? loadMarkup(resolved.edit, file) : Promise.resolve(null),
    Promise.all(resolved.show.map(async (layer) => (await loadMarkup(layer, file)).doc)),
    resolved.edit ? hasMarkupOnOlderFile(resolved.edit, file) : Promise.resolve(false),
  ]);

  return {
    ok: true,
    fileUrl: view.data.signedUrl,
    downloadUrl: download.data?.signedUrl ?? null,
    fileKind: kind === "pdf" ? "pdf" : "image",
    fileVersion: version,
    editable,
    overlays: overlays.filter((doc) => doc.items.length > 0),
    canSubmit: resolved.canSubmit,
    defaultPen: resolved.defaultPen,
    replaced: replaced && (editable?.version ?? 0) === 0,
  };
}
