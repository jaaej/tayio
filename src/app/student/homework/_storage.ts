import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase Storage buckets.
// - homework-submissions: student-uploaded submission files. Private;
//   authenticated read via signed URL; students write to a path prefixed by
//   their auth uid (enforced by storage RLS).
// - homework-attachments: tutor-provided worksheets attached to a homework.
//   Being migrated from public to private + signed URLs (checklist E4/E5).
export const HOMEWORK_BUCKET = "homework-submissions";
export const HOMEWORK_ATTACHMENT_BUCKET = "homework-attachments";
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Resolve a tutor homework attachment to a readable URL.
 * - null → null
 * - legacy full public URL (starts with "http") → returned as-is
 * - storage path → short-lived signed URL against the private attachments bucket
 *
 * Signed via the caller's session (server-side), so access is still gated by
 * whoever the page already authorized to load this homework.
 */
export async function signHomeworkAttachment(
  supabase: SupabaseClient,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const { data } = await supabase.storage
    .from(HOMEWORK_ATTACHMENT_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
