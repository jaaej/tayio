import { yearLevelLabel } from "@/lib/format";

/**
 * Subject name for a picker, with the year level only when the name does not
 * already say it ("Year 10 Maths", not "Year 10 Maths (Yr Year 10)").
 */
export function subjectOptionLabel(subject: {
  name: string;
  yearLevel: string | null;
}): string {
  if (!subject.yearLevel?.trim()) return subject.name;
  const level = yearLevelLabel(subject.yearLevel);
  return subject.name.toLowerCase().includes(level.toLowerCase())
    ? subject.name
    : `${subject.name} (${level})`;
}

/**
 * One entry per subject (by id) for a legend, filter or list, sorted by
 * label. Two subjects can share a name, so where they do the label carries
 * the year level ("Mathematics (Year 9)"); a name shown once stays bare.
 */
export function distinctSubjects<T extends { id: string; name: string; yearLevel: string | null }>(
  items: T[],
): (T & { label: string })[] {
  const byId = new Map<string, T>();
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item);
  const list = [...byId.values()];
  const named = new Map<string, number>();
  for (const s of list) {
    const key = s.name.trim().toLowerCase();
    named.set(key, (named.get(key) ?? 0) + 1);
  }
  return list
    .map((s) => ({
      ...s,
      label: (named.get(s.name.trim().toLowerCase()) ?? 0) > 1 ? subjectOptionLabel(s) : s.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
