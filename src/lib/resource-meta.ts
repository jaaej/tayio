// Client-safe display helpers for a library resource row: the file format
// ("PDF", "DOCX", "Link") and the day it was added, joined as "PDF · 8 Oct".
import { melbourneDayKey, formatDateShort } from "./format";

const FORMAT_BY_CONTENT_TYPE: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-powerpoint": "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

/**
 * The format a student would recognise for a resource. Links read "Link";
 * files use the stored file's extension, falling back to the MIME type, and
 * return null when neither says anything useful.
 */
export function resourceFormat(r: {
  kind: "file" | "link";
  storagePath: string | null;
  contentType: string | null;
}): string | null {
  if (r.kind === "link") return "Link";
  const name = r.storagePath?.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot > 0 && dot < name.length - 1) {
    const ext = name.slice(dot + 1);
    if (/^[a-z0-9]{1,5}$/i.test(ext)) return ext.toUpperCase();
  }
  const mime = r.contentType?.split(";")[0].trim().toLowerCase() ?? "";
  if (FORMAT_BY_CONTENT_TYPE[mime]) return FORMAT_BY_CONTENT_TYPE[mime];
  const [family, sub] = mime.split("/");
  if (family === "image" || family === "video" || family === "audio") {
    return sub ? sub.toUpperCase() : null;
  }
  return null;
}

/** "PDF · 8 Oct" (Melbourne day the resource was added). */
export function resourceMeta(r: {
  kind: "file" | "link";
  storagePath: string | null;
  contentType: string | null;
  createdAt: Date;
}): string {
  const added = formatDateShort(melbourneDayKey(r.createdAt));
  const format = resourceFormat(r);
  return format ? `${format} · ${added}` : added;
}
