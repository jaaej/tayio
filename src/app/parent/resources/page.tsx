import { ListPaneSearch, PageHeader } from "@/components/admin/ui";
import { requireRole } from "@/lib/auth";
import { ParentLibraryBrowser } from "./_components/library-browser";

export default async function ParentResourcesPage() {
  const user = await requireRole("parent");

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
      <ParentLibraryBrowser parentId={user.id} />
    </div>
  );
}
