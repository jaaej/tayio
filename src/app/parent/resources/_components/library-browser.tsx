import { Empty, GlassPanel } from "@/components/admin/ui";
import { ResourceLibrary } from "@/components/resources/resource-library";
import { childSubjectIds } from "@/lib/resources";
import { loadResourceLibrary } from "@/lib/resource-library";
import { openResourceForParent } from "@/app/_actions/resources";

/**
 * The parent's resource library: the student's library over the union of
 * all their children's enrolled subjects (resources belong to a subject,
 * not a child, so there is no child switch here). Files open through
 * `openResourceForParent`, which re-checks that subject set.
 */
export async function ParentLibraryBrowser({ parentId }: { parentId: string }) {
  const subjectIds = await childSubjectIds(parentId);

  if (subjectIds.length === 0) {
    return (
      <GlassPanel>
        <Empty>Your children aren&apos;t enrolled in any subjects yet.</Empty>
      </GlassPanel>
    );
  }

  const library = await loadResourceLibrary(subjectIds);
  return (
    <ResourceLibrary
      subjects={library.subjects}
      topics={library.topics}
      openAction={openResourceForParent}
    />
  );
}
