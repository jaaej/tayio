import { Empty, GlassPanel } from "@/components/admin/ui";
import { enrolledSubjectIds } from "@/lib/resources";
import { loadResourceLibrary } from "@/lib/resource-library";
import { ResourceLibrary } from "@/components/resources/resource-library";

/**
 * Server-loaded resource library for the logged-in student, scoped to their
 * enrolled subjects. Files open through `openResourceFile`, which re-checks
 * the enrolment before signing a URL.
 */
export async function LibraryBrowser({ studentId }: { studentId: string }) {
  const subjectIds = await enrolledSubjectIds(studentId);

  if (subjectIds.length === 0) {
    return (
      <GlassPanel>
        <Empty>You aren&apos;t enrolled in any subjects yet.</Empty>
      </GlassPanel>
    );
  }

  const library = await loadResourceLibrary(subjectIds);
  return (
    <ResourceLibrary subjects={library.subjects} topics={library.topics} />
  );
}
