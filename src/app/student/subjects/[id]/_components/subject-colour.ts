import { subjectFamily, subjectTone } from "@/lib/subject-tone";

/** Flat subject colours from the colourful handoff; other families use the glass solid. */
const SUBJECT_BG: Partial<Record<ReturnType<typeof subjectFamily>, string>> = {
  maths: "#159A7C",
  english: "#6A4BE6",
};

/** The deeper shade behind the Overview panel; other families use the tone's ink. */
const SUBJECT_DEEP: Partial<Record<ReturnType<typeof subjectFamily>, string>> = {
  maths: "#0F6E58",
  english: "#4A2FC0",
};

export function subjectBg(name: string): string {
  return SUBJECT_BG[subjectFamily(name)] ?? subjectTone(name).solid;
}

export function subjectDeep(name: string): string {
  return SUBJECT_DEEP[subjectFamily(name)] ?? subjectTone(name).fg;
}
