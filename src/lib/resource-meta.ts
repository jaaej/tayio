// Client-safe display helpers for a library resource row in every role: the
// format ("PDF", "DOCX", "desmos.com"), a file's size and the day it was
// added, joined as "PDF · 420 KB · 8 Oct".
import { melbourneDayKey, formatDateShort } from "./format";
import { formatBytes } from "./resource-format";

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
 * The format a viewer would recognise for a resource. Links show their site
 * ("desmos.com"), or "Link" when the address doesn't parse; files use the
 * stored file's extension, falling back to the MIME type, and return null
 * when neither says anything useful.
 */
export function resourceFormat(r: {
  kind: "file" | "link";
  storagePath: string | null;
  contentType: string | null;
  externalUrl?: string | null;
}): string | null {
  if (r.kind === "link") {
    try {
      return new URL(r.externalUrl ?? "").hostname.replace(/^www\./, "") || "Link";
    } catch {
      return "Link";
    }
  }
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

/** "PDF · 420 KB · 8 Oct" (Melbourne day the resource was added). */
export function resourceMeta(r: {
  kind: "file" | "link";
  storagePath: string | null;
  contentType: string | null;
  externalUrl?: string | null;
  sizeBytes?: number | null;
  createdAt: Date;
}): string {
  return [
    resourceFormat(r),
    r.kind === "file" && r.sizeBytes ? formatBytes(r.sizeBytes) : null,
    formatDateShort(melbourneDayKey(r.createdAt)),
  ]
    .filter(Boolean)
    .join(" · ");
}
