const LEADING_CLASS_SEPARATOR = /^[\s\u00b7|:\u2013\u2014-]+/;
const CLASS_SEGMENT_SEPARATOR = /[\u00b7|:\u2013\u2014-]/;

function sameLabel(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "base" }) === 0;
}

function words(value: string): string[] {
  return value.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Some seeded/legacy VCE classes use shortened subject aliases, such as
 * `VCE Methods` for `VCE Maths Methods`. Treat a complete leading class-name
 * segment as redundant when all of its words already exist in the subject.
 * Requiring at least two words avoids stripping broad one-word group names.
 */
function isSubjectAlias(subject: string, candidate: string): boolean {
  const subjectWords = words(subject);
  const candidateWords = words(candidate);
  if (candidateWords.length < 2 || candidateWords.length >= subjectWords.length) {
    return false;
  }

  const remaining = [...subjectWords];
  return candidateWords.every((word) => {
    const index = remaining.indexOf(word);
    if (index === -1) return false;
    remaining.splice(index, 1);
    return true;
  });
}

/**
 * Return the part of a class name that is not already conveyed by its subject.
 *
 * Class names in older data often include the subject as a prefix, for example
 * `Year 9 English · Tuesday PM`. Some records contain that prefix more than
 * once. Keeping this rule here prevents every screen and notification from
 * inventing its own de-duplication logic.
 */
export function classNameDetail(
  subjectName: string | null | undefined,
  className: string | null | undefined,
): string {
  const subject = subjectName?.trim() ?? "";
  let detail = className?.trim() ?? "";

  if (!subject) return detail;

  while (detail) {
    if (sameLabel(detail, subject)) return "";
    if (!detail.toLocaleLowerCase().startsWith(subject.toLocaleLowerCase())) {
      const separatorIndex = detail.search(CLASS_SEGMENT_SEPARATOR);
      if (separatorIndex === -1) break;

      const candidate = detail.slice(0, separatorIndex).trim();
      if (!isSubjectAlias(subject, candidate)) break;

      detail = detail
        .slice(separatorIndex)
        .replace(LEADING_CLASS_SEPARATOR, "")
        .trim();
      continue;
    }

    const suffix = detail.slice(subject.length);
    if (!LEADING_CLASS_SEPARATOR.test(suffix)) break;

    const next = suffix.replace(LEADING_CLASS_SEPARATOR, "").trim();
    if (next === detail) break;
    detail = next;
  }

  return detail;
}

/** Combine subject and class context while showing the subject only once. */
export function classDisplayName(
  subjectName: string | null | undefined,
  className: string | null | undefined,
): string {
  const subject = subjectName?.trim() ?? "";
  const detail = classNameDetail(subject, className);
  return [subject, detail].filter(Boolean).join(" · ");
}
