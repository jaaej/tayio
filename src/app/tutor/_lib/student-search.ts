import type { PortalSearchDestination } from "@/components/portal/global-search";
import { classDisplayName } from "@/lib/class-display";

type Roster = Array<{
  className: string;
  subjectName: string;
  students: Array<{ id: string; firstName: string; lastName: string }>;
}>;

/**
 * The tutor's students as search results: one entry per student (a student
 * in two of the tutor's classes appears once), named "First Last", with
 * their classes underneath ("Y9 Maths · Tuesday, Y9 English · Thursday"),
 * sorted by name.
 */
export function studentSearchEntries(roster: Roster): PortalSearchDestination[] {
  const byId = new Map<string, { name: string; classes: string[] }>();
  for (const group of roster) {
    for (const s of group.students) {
      const entry = byId.get(s.id) ?? {
        name: `${s.firstName} ${s.lastName}`.trim(),
        classes: [],
      };
      const label = classDisplayName(group.subjectName, group.className);
      if (!entry.classes.includes(label)) entry.classes.push(label);
      byId.set(s.id, entry);
    }
  }
  return [...byId.entries()]
    .map(([id, e]) => ({
      label: e.name,
      href: `/tutor/students/${id}`,
      section: e.classes.join(", "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
