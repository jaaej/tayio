import { AdminShell } from "@/components/admin/shell";
import { accountFirstName } from "@/lib/account-name";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin");
  const name = accountFirstName(user, "Admin");
  return <AdminShell userName={name}>{children}</AdminShell>;
}
