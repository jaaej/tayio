import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import { DISCUSSION_POLICY, validateUpload } from "@/lib/upload-validation";

// Private bucket (created in the Supabase dashboard). Access is gated at the
// application layer (requireRole + canSeeBoard), so both upload and signing go
// through the service-role client rather than per-object storage RLS.
export const DISCUSSION_BUCKET = "discussion-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type UploadedAttachment = {
  path: string;
  contentType: string;
};

/**
 * Validate (magic-byte sniff, size, allowlist) and upload one discussion
 * attachment under `${groupId}/<random>.<ext>`. Returns the storage path on
 * success. Uses the service-role client - callers MUST have already authorised
 * the actor for this board.
 */
export async function uploadDiscussionAttachment(
  groupId: string,
  file: File,
): Promise<{ ok: true; value: UploadedAttachment } | { ok: false; error: string }> {
  const validated = await validateUpload(file, DISCUSSION_POLICY);
  if (!validated.ok) return validated;

  const path = `${groupId}/${randomUUID()}.${validated.file.ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(DISCUSSION_BUCKET)
    .upload(path, file, {
      contentType: validated.file.contentType,
      upsert: false,
    });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { path, contentType: validated.file.contentType } };
}

/** Short-lived signed URL for a stored attachment (or null if signing fails). */
export async function signDiscussionAttachment(
  path: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(DISCUSSION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
