export type SubjectAlias = { subjectId: string; alias: string };

export type SearchableDirectoryEntry = {
  firstName: string;
  lastName: string;
  email: string;
  classInfo: Array<{
    name: string;
    subjectName: string;
    subjectId: string;
  }>;
};

export function normalizeSubjectAlias(value: string): string {
  return value.trim().toLowerCase();
}

export function matchingAliasSubjectIds(
  aliases: SubjectAlias[],
  query: string,
): Set<string> {
  const normalized = normalizeSubjectAlias(query);
  return new Set(
    aliases
      .filter((entry) => normalizeSubjectAlias(entry.alias) === normalized)
      .map((entry) => entry.subjectId),
  );
}

/** Alias matching is additive: names, emails, original class names, and full
 * subject names always continue to work even after a quick key is assigned. */
export function directoryEntryMatches(
  entry: SearchableDirectoryEntry,
  query: string,
  aliasSubjectIds: Set<string>,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return (
    `${entry.firstName} ${entry.lastName}`.toLowerCase().includes(normalized) ||
    entry.email.toLowerCase().includes(normalized) ||
    entry.classInfo.some(
      (item) =>
        item.name.toLowerCase().includes(normalized) ||
        item.subjectName.toLowerCase().includes(normalized) ||
        aliasSubjectIds.has(item.subjectId),
    )
  );
}
