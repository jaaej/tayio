export type ViewableFileKind = "pdf" | "image" | "video" | "other";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"];

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

  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split(/[?#]/, 1)[0];
  }

  const extension = pathname.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.includes(extension ?? "")) return "image";
  if (VIDEO_EXTENSIONS.includes(extension ?? "")) return "video";
  return "other";
}
