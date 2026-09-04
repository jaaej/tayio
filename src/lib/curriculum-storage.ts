import "server-only";

import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import {
  validateUpload,
  VIDEO_POLICY,
  BOOKLET_POLICY,
} from "@/lib/upload-validation";

export const BUCKET = "curriculum";
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function signCurriculumUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function uploadCurriculumFile(
  kind: "videos" | "booklets",
  ownerId: string,
  file: File,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const validated = await validateUpload(
    file,
    kind === "videos" ? VIDEO_POLICY : BOOKLET_POLICY,
  );
  if (!validated.ok) return validated;

  const path = `${kind}/${ownerId}.${validated.file.ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: validated.file.contentType,
    });

  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function removeCurriculumObject(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
