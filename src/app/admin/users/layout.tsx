import type { ReactNode } from "react";
import type { UserRole } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { isUnrestrictedAdmin } from "@/lib/roles";
import { getDirectoryPaneData } from "./_lib/directory-data";
import { UserDirectoryPane } from "./_components/user-directory-pane";

export const dynamic = "force-dynamic";

/**
 * Users split view: the directory list on the left, the selected person on
 * the right (`/admin/users/[id]`). The list lives here so it is fetched once
 * and stays mounted while the admin moves between profiles. Below xl only
 * one pane shows at a time: the list on /admin/users, the profile (with a
 * back button) on /admin/users/[id].
 */
export default async function UsersLayout({ children }: { children: ReactNode }) {
  const [me, data] = await Promise.all([
    requireRole("admin"),
    getDirectoryPaneData(),
  ]);
  const canManagePrivilegedRoles = isUnrestrictedAdmin(
    me.app_metadata?.role as UserRole | undefined,
  );

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
      <UserDirectoryPane
        items={data.items}
        schools={data.schools}
        aliases={data.aliases}
        canManagePrivilegedRoles={canManagePrivilegedRoles}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {children}
      </div>
    </div>
  );
}
