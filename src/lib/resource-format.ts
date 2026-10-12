/*
 * Display helpers for resource rows. Client-safe and pure.
 */

/**
 * The stored extension is the honest answer for an uploaded file; the MIME
 * subtype covers rows promoted out of curriculum attachments, which carry a
 * content type but not always a suffixed path. Links show their host.
 */
export function resourceFormatLabel(r: {
  kind: string;
  storagePath: string | null;
  contentType: string | null;
  externalUrl: string | null;
}): string | null {
  if (r.kind === "link") {
    try {
      return new URL(r.externalUrl ?? "").hostname.replace(/^www\./, "") || "Link";
    } catch {
      return "Link";
    }
  }
  const ext = r.storagePath?.split("/").pop()?.split(".").slice(1).pop();
  if (ext && ext.length <= 5) return ext.toUpperCase();
  const subtype = r.contentType?.split("/").pop();
  return subtype && subtype.length <= 8 ? subtype.toUpperCase() : null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
