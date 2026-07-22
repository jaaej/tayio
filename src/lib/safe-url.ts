/**
 * Returns the URL only if it is a safe http(s) link, otherwise null. Guards
 * <a href> against javascript:/data: schemes coming from stored, user-supplied
 * data (e.g. tutor-added resource links). Signed storage URLs are https and
 * pass through unchanged.
 */
export function httpHref(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}
