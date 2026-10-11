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
