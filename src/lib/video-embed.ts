// Client-safe: turns a hosted video link into an embeddable player src.

/** Embeddable player src for the common video hosts, or null when the URL cannot be embedded. */
export function hostedEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.startsWith("/embed/")
          ? url.pathname.split("/").filter(Boolean)[1]
          : null;
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const id = segments.find((segment) => /^\d+$/.test(segment));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "drive.google.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const fileIndex = segments.indexOf("d");
    const id =
      fileIndex >= 0 ? segments[fileIndex + 1] : url.searchParams.get("id");
    return id
      ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`
      : null;
  }
  if (host === "loom.com" || host === "www.loom.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    const shareIndex = segments.indexOf("share");
    const id = shareIndex >= 0 ? segments[shareIndex + 1] : null;
    return id ? `https://www.loom.com/embed/${encodeURIComponent(id)}` : null;
  }
  return null;
}
