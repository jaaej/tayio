import "server-only";

/**
 * Shared brand tokens for generated PDFs. These mirror the portal's v2
 * cornflower/indigo identity (globals.css brand-500 / brand-700 and the
 * indigo hero gradient documented in CLAUDE.md). When real brand assets land,
 * swap these values (and register a custom font) in one place.
 */
export const PDF_BRAND = {
  indigo: "#4F5BD5",
  indigoDark: "#2B3287",
  ink: "#1b1f2e",
  inkSoft: "#3f4657",
  muted: "#6b7280",
  line: "#e5e7eb",
  surfaceTint: "#eef3fe",
  good: "#15803d",
  bad: "#b91c1c",
  // Company identity - text-only until a logo asset is supplied.
  companyName: "Taiyo Tuition",
} as const;

export function formatPdfMoney(amount: number, currency = "AUD"): string {
  const n = amount.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency === "AUD" ? "$" : `${currency} `}${n}`;
}
