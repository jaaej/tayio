/*
 * The child a parent is looking at. Pages take `?child=<id>`; without it they
 * open the child the parent chose last, kept in this cookie by the child
 * switcher (any linked child the parent views is remembered). The server
 * only ever uses the cookie's id if that child is linked to the parent.
 */

export const SELECTED_CHILD_COOKIE = "taiyo_parent_child";

/** One year: the choice should survive closing the browser. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Remember `childId` in the browser (called from the client). */
export function rememberSelectedChild(childId: string): void {
  document.cookie = `${SELECTED_CHILD_COOKIE}=${encodeURIComponent(childId)}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

/**
 * The child to show: the one asked for, else the remembered one, else the
 * first. Only linked children are ever picked.
 */
export function pickSelectedChild<T extends { id: string }>(
  children: readonly T[],
  requested: string | null | undefined,
  remembered: string | null | undefined,
): T | null {
  return (
    children.find((c) => c.id === requested) ??
    children.find((c) => c.id === remembered) ??
    children[0] ??
    null
  );
}

/** A parent page link that keeps the child: `/parent/x` + `?child=` or `&child=`. */
export function withChild(href: string, childId: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}child=${childId}`;
}

/**
 * A parent's copy of a family notification, led by the children it is about:
 * "Sarah · Year 9 Maths · Thu 4 pm", "Sarah and Leo · ...".
 */
export function forParent(childNames: readonly string[], body: string): string {
  const names = childNames.filter(Boolean);
  if (names.length === 0) return body;
  const lead =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${lead} · ${body}`;
}
