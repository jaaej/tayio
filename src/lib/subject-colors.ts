/**
 * Subject colour-family tokens. Used by SubjectCard and any role-side UI
 * that needs to colour-code by subject (homework cards, schedule chips, etc.).
 *
 * Keep this module pure data + a name-heuristic function — no React. Visual
 * components compose these tokens via inline styles.
 */

export type AccentFamily =
  | "periwinkle"
  | "amber"
  | "emerald"
  | "rose"
  | "violet"
  | "cyan";

export type AccentTokens = {
  /** soft gradient top — for tinted card backgrounds */
  bgFrom: string;
  /** soft gradient bottom */
  bgTo: string;
  /** card border colour */
  ring: string;
  /** primary title text colour */
  title: string;
  /** secondary / meta text colour */
  meta: string;
  /** small accent — arrows, dots, rails */
  arrow: string;
};

export const ACCENT_TOKENS: Record<AccentFamily, AccentTokens> = {
  periwinkle: {
    bgFrom: "rgba(94, 123, 199, 0.18)",
    bgTo: "rgba(94, 123, 199, 0.05)",
    ring: "rgba(94, 123, 199, 0.4)",
    title: "#2e3a6b",
    meta: "rgba(46, 58, 107, 0.7)",
    arrow: "#5e7bc7",
  },
  amber: {
    bgFrom: "rgba(217, 119, 6, 0.16)",
    bgTo: "rgba(217, 119, 6, 0.04)",
    ring: "rgba(217, 119, 6, 0.4)",
    title: "#92400e",
    meta: "rgba(146, 64, 14, 0.75)",
    arrow: "#d97706",
  },
  emerald: {
    bgFrom: "rgba(5, 150, 105, 0.16)",
    bgTo: "rgba(5, 150, 105, 0.04)",
    ring: "rgba(5, 150, 105, 0.4)",
    title: "#065f46",
    meta: "rgba(6, 95, 70, 0.75)",
    arrow: "#059669",
  },
  rose: {
    bgFrom: "rgba(225, 29, 72, 0.14)",
    bgTo: "rgba(225, 29, 72, 0.03)",
    ring: "rgba(225, 29, 72, 0.4)",
    title: "#9f1239",
    meta: "rgba(159, 18, 57, 0.75)",
    arrow: "#e11d48",
  },
  violet: {
    bgFrom: "rgba(124, 58, 237, 0.16)",
    bgTo: "rgba(124, 58, 237, 0.04)",
    ring: "rgba(124, 58, 237, 0.4)",
    title: "#5b21b6",
    meta: "rgba(91, 33, 182, 0.75)",
    arrow: "#7c3aed",
  },
  cyan: {
    bgFrom: "rgba(8, 145, 178, 0.16)",
    bgTo: "rgba(8, 145, 178, 0.04)",
    ring: "rgba(8, 145, 178, 0.4)",
    title: "#155e75",
    meta: "rgba(21, 94, 117, 0.8)",
    arrow: "#0891b2",
  },
};

export function getAccentTokens(family: AccentFamily): AccentTokens {
  return ACCENT_TOKENS[family];
}

/**
 * Map a subject name to a colour family. Heuristic by name so new
 * subjects pick a reasonable family without needing a registry.
 */
export function colorFamilyForSubject(name: string): AccentFamily {
  const n = name.toLowerCase();
  if (n.includes("english") || n.includes("literature")) return "amber";
  if (n.includes("physics")) return "violet";
  if (n.includes("chemistry") || n.includes("chem")) return "emerald";
  if (n.includes("biology") || n.includes("bio")) return "rose";
  if (n.includes("history") || n.includes("geo") || n.includes("legal"))
    return "cyan";
  // Math / Methods / Specialist / default → periwinkle (brand)
  return "periwinkle";
}
