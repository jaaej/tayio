import { PortalShell } from "@/components/portal/shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin");
  const name =
    (user.user_metadata?.first_name as string) ??
    user.email?.split("@")[0] ??
    "Admin";
  return (
    <PortalShell role="admin" userName={name}>
      {children}
    </PortalShell>
  );
}
