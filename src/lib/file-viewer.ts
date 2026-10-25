export type ViewableFileKind = "pdf" | "image" | "video" | "office" | "other";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"];

/** Word, PowerPoint and Excel, by extension and by content type. */
const OFFICE_FAMILY: Record<string, "word" | "powerpoint" | "excel"> = {
  doc: "word",
  docx: "word",
  ppt: "powerpoint",
  pptx: "powerpoint",
  xls: "excel",
  xlsx: "excel",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.ms-powerpoint": "powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "powerpoint",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
};

/** The largest files Microsoft's web viewer opens (Word and PowerPoint 10 MB, Excel 5 MB). */
const OFFICE_PREVIEW_MAX_BYTES = {
  word: 10 * 1024 * 1024,
  powerpoint: 10 * 1024 * 1024,
  excel: 5 * 1024 * 1024,
};

function extensionOf(url: string): string | undefined {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split(/[?#]/, 1)[0];
  }
  return pathname.split(".").pop()?.toLowerCase();
}

/**
 * How the portal can show a file: by its stored content type when there is
 * one (a file promoted from a curriculum attachment may have no extension),
 * otherwise by the extension in its path or signed URL.
 */
export function viewableFileKind(url: string, contentType?: string | null): ViewableFileKind {
  const type = contentType?.toLowerCase().split(";")[0].trim();
  if (type === "application/pdf") return "pdf";
  if (type?.startsWith("image/") && IMAGE_EXTENSIONS.includes(type.slice(6))) return "image";
  if (type?.startsWith("video/")) return "video";
  if (type && OFFICE_FAMILY[type]) return "office";

  const extension = extensionOf(url) ?? "";
  if (extension === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  if (OFFICE_FAMILY[extension]) return "office";
  return "other";
}

/**
 * Can Microsoft's web viewer show this Office file? False when it is over
 * the viewer's size limit (it would show its own error inside the portal)
 * or is not an Office file at all.
 */
export function officePreviewFits(
  url: string,
  contentType: string | null | undefined,
  sizeBytes: number | null | undefined,
): boolean {
  const type = contentType?.toLowerCase().split(";")[0].trim() ?? "";
  const family = OFFICE_FAMILY[type] ?? OFFICE_FAMILY[extensionOf(url) ?? ""];
  if (!family) return false;
  return sizeBytes == null || sizeBytes <= OFFICE_PREVIEW_MAX_BYTES[family];
}

/**
 * Microsoft's web viewer for an Office file at a public (signed) address:
 * "embed" for inside the portal's viewer, "view" for its full page.
 */
export function officeViewerUrl(fileUrl: string, mode: "embed" | "view"): string {
  return `https://view.officeapps.live.com/op/${mode}.aspx?src=${encodeURIComponent(fileUrl)}`;
}
