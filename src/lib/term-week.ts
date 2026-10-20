import { weekNumberOn } from "@/lib/week-plan-rules";

/**
 * Which week of term a Monday-to-Sunday week is, for the check-in pages.
 * Weeks are numbered by `weekNumberOn`, the rule the curriculum, the class
 * hub and the portal home headers use, read on the week's first term day.
 */

export type TermDates = { termNumber: number; startDate: string; endDate: string };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * "Term 4, Week 2" for the week starting `weekStart` (a Monday, YYYY-MM-DD),
 * from the earliest-starting term with a day in that week; "Holidays" when
 * no term has one; null when no terms are set, since "Holidays" would then
 * be a guess.
 */
export function weekOfTermLabel(terms: TermDates[], weekStart: string): string | null {
  if (terms.length === 0) return null;
  const weekEnd = addDays(weekStart, 6);
  const term = terms
    .filter((t) => t.startDate <= weekEnd && t.endDate >= weekStart)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (!term) return "Holidays";
  const firstTermDay = term.startDate > weekStart ? term.startDate : weekStart;
  return `Term ${term.termNumber}, Week ${weekNumberOn(term.startDate, firstTermDay)}`;
}
