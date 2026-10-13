import { ListPaneSearch, PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { LibraryBrowser } from "./_components/library-browser";
import { RecordedLessons } from "./_components/recorded-lessons";

export default async function ResourcesIndexPage() {
  const user = await requireRole("student");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Resources"
        actions={
          <div className="w-[260px] max-w-full [&_input]:h-[42px] [&_input]:rounded-[12px] [&_input]:border-0">
            <ListPaneSearch label="Search resources" placeholder="Search title…" />
          </div>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <LibraryBrowser studentId={user.id} />
        <RecordedLessons studentId={user.id} />
      </div>
    </div>
  );
}
