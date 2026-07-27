import "server-only";

import { randomUUID } from "crypto";
import { createAdminClient } from "@/app/admin/_lib/supabase-admin";
import {
  QUIZ_ATTACHMENT_POLICY,
  validateUpload,
} from "@/lib/upload-validation";

export const QUIZ_ATTACHMENT_BUCKET = "resource-library";
export const QUIZ_ATTACHMENT_LIMIT = 6;
export const QUIZ_UPLOAD_BATCH_LIMIT = 3;
export const QUIZ_ATTACHMENT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.ppt,.pptx,.txt";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type UploadedQuizAttachment = {
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
};

/**
 * Stores quiz supporting material in the existing private resource bucket.
 * The caller must authorise the quiz before calling this helper.
 */
export async function uploadQuizAttachmentFile(
  quizId: string,
  file: File,
): Promise<
  { ok: true; value: UploadedQuizAttachment } | { ok: false; error: string }
> {
  const validated = await validateUpload(file, QUIZ_ATTACHMENT_POLICY);
  if (!validated.ok) return validated;

  const storagePath = `quizzes/${quizId}/${randomUUID()}.${validated.file.ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(QUIZ_ATTACHMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: validated.file.contentType,
      upsert: false,
    });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    value: {
      storageBucket: QUIZ_ATTACHMENT_BUCKET,
      storagePath,
      contentType: validated.file.contentType,
      sizeBytes: file.size,
    },
  };
}

export async function removeQuizAttachmentFile(
  storageBucket: string,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(storageBucket)
    .remove([storagePath]);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signQuizAttachment(
  storageBucket: string,
  storagePath: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
