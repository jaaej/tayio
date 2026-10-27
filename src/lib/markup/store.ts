import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { fileMarkups } from "@/db/schema";
import { EMPTY_DOC, readMarkupDoc, type MarkupDoc } from "./doc";
import type { MarkupLayerKey } from "./targets";

type FileKey = { bucket: string; path: string; version: string };

function where(layer: MarkupLayerKey, file: FileKey) {
  return and(
    eq(fileMarkups.layer, layer.layer),
    eq(fileMarkups.ownerId, layer.ownerId),
    eq(fileMarkups.fileBucket, file.bucket),
    eq(fileMarkups.filePath, file.path),
    eq(fileMarkups.fileVersion, file.version),
  );
}

/** One layer's marks on this version of the file, and its save count (0 when never saved). */
export async function loadMarkup(layer: MarkupLayerKey, file: FileKey): Promise<{ doc: MarkupDoc; version: number }> {
  const [row] = await db
    .select({ data: fileMarkups.data, version: fileMarkups.version })
    .from(fileMarkups)
    .where(where(layer, file))
    .limit(1);
  return row ? { doc: readMarkupDoc(row.data), version: row.version } : { doc: EMPTY_DOC, version: 0 };
}

/** Did this layer have marks on an earlier version of the file (now replaced)? */
export async function hasMarkupOnOlderFile(layer: MarkupLayerKey, file: FileKey): Promise<boolean> {
  const [row] = await db
    .select({ id: fileMarkups.id })
    .from(fileMarkups)
    .where(
      and(
        eq(fileMarkups.layer, layer.layer),
        eq(fileMarkups.ownerId, layer.ownerId),
        eq(fileMarkups.fileBucket, file.bucket),
        eq(fileMarkups.filePath, file.path),
        ne(fileMarkups.fileVersion, file.version),
        sql`jsonb_array_length(${fileMarkups.data} -> 'items') > 0`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Saves a layer if `baseVersion` is the version the writer opened (0 for a
 * layer never saved). Returns the new version, or the current one as a
 * conflict when someone saved in between (another tab or device).
 */
export async function saveMarkup(
  layer: MarkupLayerKey,
  file: FileKey,
  doc: MarkupDoc,
  baseVersion: number,
  updatedBy: string,
): Promise<{ ok: true; version: number } | { ok: false; version: number }> {
  const now = new Date();
  const saved =
    baseVersion === 0
      ? await db
          .insert(fileMarkups)
          .values({
            layer: layer.layer,
            ownerId: layer.ownerId,
            fileBucket: file.bucket,
            filePath: file.path,
            fileVersion: file.version,
            data: doc,
            version: 1,
            updatedBy,
          })
          .onConflictDoNothing()
          .returning({ version: fileMarkups.version })
      : await db
          .update(fileMarkups)
          .set({ data: doc, version: sql`${fileMarkups.version} + 1`, updatedBy, updatedAt: now })
          .where(and(where(layer, file), eq(fileMarkups.version, baseVersion)))
          .returning({ version: fileMarkups.version });
  if (saved[0]) return { ok: true, version: saved[0].version };
  const current = await loadMarkup(layer, file);
  return { ok: false, version: current.version };
}
