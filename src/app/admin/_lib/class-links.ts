/**
 * A class is edited on its subject's page, at its own card. Link there
 * directly; `/admin/classes/[id]` only redirects here for older links
 * (notifications already sent).
 */
export function classEditHref(subjectId: string, classId: string): string {
  return `/admin/subjects/${subjectId}/edit#class-${classId}`;
}
