import { PageHeader } from "@/components/parent/ui";
import { requireRole } from "@/lib/auth";
import { ParentLibraryBrowser } from "./_components/library-browser";

export default async function ParentResourcesPage() {
  const user = await requireRole("parent");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
      />

      <div className="rise" style={{ animationDelay: "60ms" }}>
        <ParentLibraryBrowser parentId={user.id} />
      </div>
    </div>
  );
}
