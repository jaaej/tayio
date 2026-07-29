/**
 * Subject colour-family tokens. Used by SubjectCard and any role-side UI
 * that needs to colour-code by subject (homework cards, schedule chips, etc.).
 *
 * Keep this module pure data + a name-heuristic function - no React. Visual
 * components compose these tokens via inline styles.
 */

export type AccentFamily =
  | "periwinkle"
  | "amber"
  | "emerald"
  | "rose"
  | "red"
  | "violet"
  | "cyan";

export type AccentTokens = {
  /** soft gradient top - for tinted card backgrounds */
  bgFrom: string;
  /** soft gradient bottom */
  bgTo: string;
  /** card border colour */
  ring: string;
  /** primary title text colour */
  title: string;
  /** secondary / meta text colour */
  meta: string;
  /** small accent - arrows, dots, rails */
  arrow: string;
  /** vibrant pill background - for tags / chips */
  pillBg: string;
  /** bold pill text colour */
  pillText: string;
};

export const ACCENT_TOKENS: Record<AccentFamily, AccentTokens> = {
  periwinkle: {
    bgFrom: "rgb(196, 209, 244)",
    bgTo: "rgb(220, 229, 251)",
    ring: "rgb(120, 145, 215)",
    title: "#1d2951",
    meta: "rgba(29, 41, 81, 0.85)",
    arrow: "#4f66ad",
    pillBg: "#e0e7ff",
    pillText: "#3730a3",
  },
  amber: {
    bgFrom: "rgb(253, 220, 170)",
    bgTo: "rgb(254, 236, 200)",
    ring: "rgb(234, 170, 90)",
    title: "#78350f",
    meta: "rgba(120, 53, 15, 0.9)",
    arrow: "#b45309",
    pillBg: "#fde68a",
    pillText: "#92400e",
  },
  emerald: {
    bgFrom: "rgb(170, 226, 205)",
    bgTo: "rgb(205, 240, 225)",
    ring: "rgb(80, 190, 150)",
    title: "#064e3b",
    meta: "rgba(6, 78, 59, 0.9)",
    arrow: "#047857",
    pillBg: "#a7f3d0",
    pillText: "#065f46",
  },
  rose: {
    bgFrom: "rgb(248, 195, 210)",
    bgTo: "rgb(253, 220, 228)",
    ring: "rgb(230, 130, 155)",
    title: "#881337",
    meta: "rgba(136, 19, 55, 0.9)",
    arrow: "#be123c",
    pillBg: "#fbcfe8",
    pillText: "#9f1239",
  },
  violet: {
    bgFrom: "rgb(208, 192, 248)",
    bgTo: "rgb(228, 218, 252)",
    ring: "rgb(160, 130, 232)",
    title: "#4c1d95",
    meta: "rgba(76, 29, 149, 0.9)",
    arrow: "#6d28d9",
    pillBg: "#ddd6fe",
    pillText: "#5b21b6",
  },
  cyan: {
    bgFrom: "rgb(170, 210, 230)",
    bgTo: "rgb(205, 230, 242)",
    ring: "rgb(95, 170, 200)",
    title: "#0e4e63",
    meta: "rgba(14, 78, 99, 0.9)",
    arrow: "#0e7490",
    pillBg: "#bae6fd",
    pillText: "#155e75",
  },
  red: {
    bgFrom: "rgb(252, 195, 195)",
    bgTo: "rgb(254, 220, 220)",
    ring: "rgb(234, 105, 105)",
    title: "#7f1d1d",
    meta: "rgba(127, 29, 29, 0.9)",
    arrow: "#dc2626",
    pillBg: "#fecaca",
    pillText: "#991b1b",
  },
};

export function getAccentTokens(family: AccentFamily): AccentTokens {
  return ACCENT_TOKENS[family];
}

const FAMILY_CYCLE: AccentFamily[] = [
  "red",
  "amber",
  "emerald",
  "violet",
  "cyan",
  "rose",
  "periwinkle",
];

/**
 * Map a subject name to a colour family.
 *
 * 1. Subject-keyword heuristics first so well-known subjects (Maths, English,
 *    etc.) pick semantically meaningful colours.
 * 2. Any unmatched name is hashed across FAMILY_CYCLE so two arbitrary
 *    subjects don't collide. Hashing on the name keeps the assignment
 *    stable across pages and reloads.
 */
export function colorFamilyForSubject(name: string): AccentFamily {
  const n = name.toLowerCase();
  if (
    n.includes("math") ||
    n.includes("methods") ||
    n.includes("specialist")
  )
    return "red";
  if (n.includes("english") || n.includes("literature")) return "amber";
  if (n.includes("physics")) return "violet";
  if (n.includes("chemistry") || n.includes("chem")) return "emerald";
  if (n.includes("biology") || n.includes("bio")) return "rose";
  if (n.includes("history") || n.includes("geo") || n.includes("legal"))
    return "cyan";

  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = (hash * 31 + n.charCodeAt(i)) | 0;
  }
  return FAMILY_CYCLE[Math.abs(hash) % FAMILY_CYCLE.length];
}
