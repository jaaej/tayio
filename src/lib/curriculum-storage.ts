import { createClient } from "@/lib/supabase/server";

export const BUCKET = "curriculum";
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const VIDEO_MAX_BYTES = 500 * 1024 * 1024;
export const BOOKLET_MAX_BYTES = 25 * 1024 * 1024;

export const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
export const BOOKLET_MIMES = ["application/pdf"];

export async function signCurriculumUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
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
  const maxBytes = kind === "videos" ? VIDEO_MAX_BYTES : BOOKLET_MAX_BYTES;
  const mimes = kind === "videos" ? VIDEO_MIMES : BOOKLET_MIMES;

  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File exceeds max size (${maxBytes / (1024 * 1024)} MB)`,
    };
  }
  if (!mimes.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type}` };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${kind}/${ownerId}.${ext}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}
