export type ViewableFileKind = "pdf" | "image" | "video" | "other";

export function viewableFileKind(url: string): ViewableFileKind {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split(/[?#]/, 1)[0];
  }

  const extension = pathname.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension ?? "")) {
    return "image";
  }
  if (["mp4", "webm", "mov"].includes(extension ?? "")) return "video";
  return "other";
}
