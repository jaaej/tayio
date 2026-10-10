/**
 * Is a navigation link active for the current path? Shared by every role's
 * desktop sidebar and the phone menu so both always highlight the same item.
 *
 * A portal root such as `/admin` or `/tutor` is the dashboard and only matches
 * exactly; deeper destinations also match their child routes, so
 * `/admin/users` stays active on `/admin/users/[id]`.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  const routeDepth = href.split("/").filter(Boolean).length;
  return routeDepth > 1 && pathname.startsWith(`${href}/`);
}
