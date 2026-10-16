import { subjectTone } from "@/lib/subject-tone";

/**
 * Small coloured tag for a subject, in the subject's colour.
 * Used inline next to homework titles, lesson chips, etc.
 */
export function SubjectPill({
  name,
  color,
  size = "sm",
}: {
  name: string;
  /** The subject's stored colour (`subjects.color`). */
  color: string | null;
  size?: "sm" | "md";
}) {
  const tone = subjectTone(name, color);
  const sizeClass =
    size === "md"
      ? "px-3 py-1 text-sm"
      : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${sizeClass}`}
      style={{
        backgroundColor: tone.bg,
        color: tone.fg,
      }}
    >
      {name}
    </span>
  );
}
