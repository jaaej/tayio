/**
 * Subject colours for the glass redesign: one dot colour, one block
 * fill/text pair and one saturated fill per subject family, matched by name. Kept separate from
 * subject-colors.ts (the older periwinkle families the other roles still use)
 * until the redesign rolls out to every role.
 */
export type SubjectFamily = "maths" | "english" | "science" | "senior" | "other";

export type SubjectTone = {
  family: SubjectFamily;
  /** Small square dot beside a subject or class name. */
  dot: string;
  /** Calendar block / chip fill. */
  bg: string;
  /** Text on `bg`; meets 4.5:1. */
  fg: string;
  /** Saturated fill for the one featured block (the student's next subject);
   *  white text on it meets 4.5:1. */
  solid: string;
};

const TONES: Record<SubjectFamily, Omit<SubjectTone, "family">> = {
  maths: { dot: "#2E9C86", bg: "#DDF3EE", fg: "#0B5C4E", solid: "#1B7A67" },
  english: { dot: "#7C62F0", bg: "#EEEBFD", fg: "#3A1AA8", solid: "#5E3FE0" },
  science: { dot: "#4C7FE8", bg: "#E7EFFD", fg: "#1E4FB8", solid: "#2F62CF" },
  senior: { dot: "#D2588F", bg: "#FBE8F1", fg: "#9D2C61", solid: "#B33F75" },
  other: { dot: "#8C8AA0", bg: "#EEEFF6", fg: "#4A4660", solid: "#5E5A73" },
};

export function subjectFamily(name: string): SubjectFamily {
  const n = name.toLowerCase();
  // VCE maths and the senior maths studies share one colour.
  if (/\b(methods|specialist|vce maths|further|general maths)\b/.test(n)) return "senior";
  if (/math|numeracy|algebra|geometry/.test(n)) return "maths";
  if (/english|literature|eal|writing|reading/.test(n)) return "english";
  if (/science|physics|chem|biology|bio\b|psychology/.test(n)) return "science";
  return "other";
}

export function subjectTone(name: string): SubjectTone {
  const family = subjectFamily(name);
  return { family, ...TONES[family] };
}
