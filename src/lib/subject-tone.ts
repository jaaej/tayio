/**
 * Subject colours, shared by every role. An admin picks one palette key per
 * subject (`subjects.color`); a subject without one gets a key from its name.
 * Each key carries a tested set of shades, so any choice stays readable.
 */
export const SUBJECT_COLORS = [
  "teal",
  "violet",
  "blue",
  "pink",
  "grey",
  "red",
  "orange",
  "amber",
  "green",
  "cyan",
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

const TONES: Record<SubjectColor, Omit<SubjectTone, "color">> = {
  teal: { label: "Teal", dot: "#2E9C86", bg: "#DDF3EE", fg: "#0B5C4E", solid: "#1B7A67", flat: "#159A7C", deep: "#0F6E58" },
  violet: { label: "Violet", dot: "#7C62F0", bg: "#EEEBFD", fg: "#3A1AA8", solid: "#5E3FE0", flat: "#6A4BE6", deep: "#4A2FC0" },
  blue: { label: "Blue", dot: "#4C7FE8", bg: "#E7EFFD", fg: "#1E4FB8", solid: "#2F62CF", flat: "#2F62CF", deep: "#1E4FB8" },
  pink: { label: "Pink", dot: "#D2588F", bg: "#FBE8F1", fg: "#9D2C61", solid: "#B33F75", flat: "#B33F75", deep: "#9D2C61" },
  grey: { label: "Grey", dot: "#8C8AA0", bg: "#EEEFF6", fg: "#4A4660", solid: "#5E5A73", flat: "#5E5A73", deep: "#4A4660" },
  red: { label: "Red", dot: "#E05555", bg: "#FCE9E9", fg: "#9E1F1F", solid: "#C22F2F", flat: "#C22F2F", deep: "#9E1F1F" },
  orange: { label: "Orange", dot: "#EB7D3C", bg: "#FDEEE4", fg: "#913A0B", solid: "#B44C12", flat: "#B44C12", deep: "#913A0B" },
  amber: { label: "Amber", dot: "#E0A21E", bg: "#FCF3DC", fg: "#6E4A00", solid: "#8A5D00", flat: "#8A5D00", deep: "#6E4A00" },
  green: { label: "Green", dot: "#56A84E", bg: "#E6F4E4", fg: "#245E20", solid: "#2F7A2A", flat: "#2F7A2A", deep: "#245E20" },
  cyan: { label: "Cyan", dot: "#1FA2C7", bg: "#DFF3F9", fg: "#0A5870", solid: "#0E7090", flat: "#0E7090", deep: "#0A5870" },
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
  if (/\b(methods|specialist|vce maths|further|general maths)\b/.test(n)) return "pink";
  if (/math|numeracy|algebra|geometry/.test(n)) return "teal";
  if (/english|literature|eal|writing|reading/.test(n)) return "violet";
  if (/science|physics|chem|biology|bio\b|psychology/.test(n)) return "blue";
  return "grey";
}

/** `color` is the subject's stored key (`subjects.color`), null when unset. */
export function subjectTone(
  name: string,
  color: string | null | undefined,
): SubjectTone {
  const key = isSubjectColor(color) ? color : defaultSubjectColor(name);
  return { color: key, ...TONES[key] };
}
