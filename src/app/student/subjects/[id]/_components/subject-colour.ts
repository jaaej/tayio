import { subjectFamily, subjectTone } from "@/lib/subject-tone";

/** Flat subject colours from the colourful handoff; other families use the glass solid. */
const SUBJECT_BG: Partial<Record<ReturnType<typeof subjectFamily>, string>> = {
  maths: "#159A7C",
  english: "#6A4BE6",
};

export function subjectBg(name: string): string {
  return SUBJECT_BG[subjectFamily(name)] ?? subjectTone(name).solid;
}
