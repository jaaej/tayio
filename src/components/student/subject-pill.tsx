import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";

/**
 * Subject chip - a colour-coded pill keyed off the subject name, using the
 * same accent family the subject uses everywhere else in the portal. Shared
 * by the homework row, quest row, and today timeline so the "little
 * sub-block" treatment stays identical across the student portal.
 */
export function SubjectPill({ subject }: { subject: string }) {
  const tokens = getAccentTokens(colorFamilyForSubject(subject));
  return (
    <span
      className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-bold leading-none whitespace-nowrap"
      style={{ background: tokens.pillBg, color: tokens.pillText }}
    >
      {subject}
    </span>
  );
}
