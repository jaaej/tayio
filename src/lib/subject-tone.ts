/**
 * Subject colours, shared by every role. An admin picks one palette key per
 * subject (`subjects.color`); a subject without one gets a key from its name.
 * Each key carries a tested set of shades, so any choice stays readable.
 */
export const SUBJECT_COLORS = [
  "teal",
  "violet",
  "blue",
  "rose",
  "amber",
  "red",
  "green",
  "cyan",
  "navy",
  "slate",
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

export type SubjectTone = {
  color: SubjectColor;
  /** Name shown on the colour picker swatch. */
  label: string;
  /** Small square dot beside a subject or class name. */
  dot: string;
  /** Calendar block / chip fill. */
  bg: string;
  /** Text on `bg`; meets 4.5:1. */
  fg: string;
  /** Saturated fill for the one featured block; white text meets 4.5:1. */
  solid: string;
  /** Flat hero fill on the student subject pages; white large text meets 3:1. */
  flat: string;
  /** Deep panel fill behind white text (the student Overview); meets 4.5:1. */
  deep: string;
};

// Dots are the swatches from the admin edit handoff; the tints, text and
// fills around them follow the original subject families.
const TONES: Record<SubjectColor, Omit<SubjectTone, "color">> = {
  teal: { label: "Teal", dot: "#2E9C86", bg: "#DDF3EE", fg: "#0B5C4E", solid: "#1B7A67", flat: "#159A7C", deep: "#0F6E58" },
  violet: { label: "Violet", dot: "#7C62F0", bg: "#EEEBFD", fg: "#3A1AA8", solid: "#5E3FE0", flat: "#6A4BE6", deep: "#4A2FC0" },
  blue: { label: "Blue", dot: "#4C7FE8", bg: "#E7EFFD", fg: "#1E4FB8", solid: "#2F62CF", flat: "#2F62CF", deep: "#1E4FB8" },
  rose: { label: "Rose", dot: "#D2588F", bg: "#FBE8F1", fg: "#9D2C61", solid: "#B33F75", flat: "#B33F75", deep: "#9D2C61" },
  amber: { label: "Amber", dot: "#D9822B", bg: "#FCEFDF", fg: "#7A4108", solid: "#9A5310", flat: "#9A5310", deep: "#7A4108" },
  red: { label: "Red", dot: "#D64545", bg: "#FBE7E7", fg: "#9B1C1C", solid: "#BF2F2F", flat: "#BF2F2F", deep: "#9B1C1C" },
  green: { label: "Green", dot: "#4C9A2A", bg: "#E6F2DF", fg: "#2B5E14", solid: "#3A7A1F", flat: "#3A7A1F", deep: "#2B5E14" },
  cyan: { label: "Cyan", dot: "#1C98B8", bg: "#DDF2F8", fg: "#0A5870", solid: "#0E7090", flat: "#0E7090", deep: "#0A5870" },
  navy: { label: "Navy", dot: "#2C4A86", bg: "#E4E9F4", fg: "#1F3566", solid: "#2C4A86", flat: "#2C4A86", deep: "#1F3566" },
  slate: { label: "Slate", dot: "#64748B", bg: "#EDF0F4", fg: "#334155", solid: "#475569", flat: "#475569", deep: "#334155" },
};

export function isSubjectColor(value: unknown): value is SubjectColor {
  return (
    typeof value === "string" &&
    (SUBJECT_COLORS as readonly string[]).includes(value)
  );
}

/** The colour a subject gets from its name until an admin picks one. */
export function defaultSubjectColor(name: string): SubjectColor {
  const n = name.toLowerCase();
  // VCE maths and the senior maths studies share one colour.
  if (/\b(methods|specialist|vce maths|further|general maths)\b/.test(n)) return "rose";
  if (/math|numeracy|algebra|geometry/.test(n)) return "teal";
  if (/english|literature|eal|writing|reading/.test(n)) return "violet";
  if (/science|physics|chem|biology|bio\b|psychology/.test(n)) return "blue";
  return "slate";
}

/** `color` is the subject's stored key (`subjects.color`), null when unset. */
export function subjectTone(
  name: string,
  color: string | null | undefined,
): SubjectTone {
  const key = isSubjectColor(color) ? color : defaultSubjectColor(name);
  return { color: key, ...TONES[key] };
}
