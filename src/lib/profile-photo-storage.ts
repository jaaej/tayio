import "server-only";

import { createAdminClient } from "@/app/admin/_lib/supabase-admin";

export const PROFILE_PHOTO_BUCKET = "profile-photos";
const SIGNED_URL_TTL_SECONDS = 3600;

export async function signProfilePhoto(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("http")) return value;

  const { data } = await createAdminClient()
    .storage.from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function removeProfilePhoto(
  value: string | null | undefined,
): Promise<void> {
  if (!value || value.startsWith("http")) return;
  const { error } = await createAdminClient()
    .storage.from(PROFILE_PHOTO_BUCKET)
    .remove([value]);
  if (error) {
    console.error("profile photo cleanup failed", error);
  }
}
