import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { RESOURCE_POLICY, validateUpload } from "@/lib/upload-validation";

export const RESOURCE_BUCKET = "resource-library";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type UploadedResource = {
  bucket: string;
  path: string;
  contentType: string;
  sizeBytes: number;
};

export async function uploadResourceFile(
  subjectId: string,
  file: File,
): Promise<{ ok: true; value: UploadedResource } | { ok: false; error: string }> {
  const validated = await validateUpload(file, RESOURCE_POLICY);
  if (!validated.ok) return validated;

  const path = `${subjectId}/${randomUUID()}.${validated.file.ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .upload(path, file, { contentType: validated.file.contentType, upsert: false });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    value: {
      bucket: RESOURCE_BUCKET,
      path,
      contentType: validated.file.contentType,
      sizeBytes: file.size,
    },
  };
}

/** Short-lived signed URL for a stored resource in any bucket (resource-library or curriculum). */
export async function signResourceAttachment(
  bucket: string,
  path: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
