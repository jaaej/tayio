/*
 * Display helpers for resource rows. Client-safe and pure.
 */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

/**
 * The name a downloaded resource saves as: its title (characters a file
 * system refuses replaced) with the stored file's extension, since resources
 * keep no original file name. "Fractions: Week 3" -> "Fractions Week 3.pdf".
 */
export function resourceDownloadName(r: {
  title: string;
  storagePath: string | null;
  contentType: string | null;
}): string {
  const base =
    r.title
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Resource";
  const fromPath = r.storagePath?.split("/").pop()?.match(/\.([a-z0-9]{1,5})$/i)?.[1];
  const ext = (fromPath ?? EXTENSION_BY_TYPE[r.contentType?.split(";")[0].trim() ?? ""])?.toLowerCase();
  if (!ext || base.toLowerCase().endsWith(`.${ext}`)) return base;
  return `${base}.${ext}`;
}
