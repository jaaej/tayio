import { Card } from "@/components/ui/card";
import { childSubjectIds } from "@/lib/resources";
import { loadResourceLibrary } from "@/lib/resource-library";
import { colorFamilyForSubject, getAccentTokens } from "@/lib/subject-colors";
import { openResourceForParent } from "@/app/_actions/resources";
import {
  LibraryBrowserClient,
  type LibrarySubjectGroup,
} from "@/components/resources/library-browser-client";

/**
 * Server-loaded resource library for the logged-in parent, scoped to the
 * union of all their children's actively-enrolled subjects (via
 * `childSubjectIds`). Loads through the same `loadResourceLibrary` as the
 * student Resources page, but resources aggregate across every child at once
 * rather than a single student, since resources are subject-scoped (not
 * per-child) and the subject grouping already makes the origin clear without
 * a child switcher.
 */
export async function ParentLibraryBrowser({ parentId }: { parentId: string }) {
  const subjectIds = await childSubjectIds(parentId);

  if (subjectIds.length === 0) {
    return (
      <Card>
        <div className="py-6 text-sm text-ink-soft">
          No resources yet - your children aren&apos;t enrolled in any subjects.
        </div>
      </Card>
    );
  }

  const library = await loadResourceLibrary(subjectIds);
  const groups: LibrarySubjectGroup[] = library.subjects.map((s) => ({
    ...s,
    tokens: getAccentTokens(colorFamilyForSubject(s.subjectName)),
  }));

  return (
    <LibraryBrowserClient
      groups={groups}
      topicOptions={library.topics}
      openAction={openResourceForParent}
    />
  );
}
