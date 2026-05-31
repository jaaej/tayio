import {
  colorFamilyForSubject,
  getAccentTokens,
} from "@/lib/subject-colors";

/**
 * Small colored tag for a subject, derived from the subject name.
 * Used inline next to homework titles, lesson chips, etc.
 */
export function SubjectPill({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const tokens = getAccentTokens(colorFamilyForSubject(name));
  const sizeClass =
    size === "md"
      ? "px-3 py-1 text-sm"
      : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${sizeClass}`}
      style={{
        backgroundColor: tokens.pillBg,
        color: tokens.pillText,
      }}
    >
      {name}
    </span>
  );
}
