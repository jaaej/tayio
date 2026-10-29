import { ParentShell } from "@/components/parent/shell";
import { accountFirstName } from "@/lib/account-name";
import { requireRole } from "@/lib/auth";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("parent");
  const name = accountFirstName(user, "Parent");
  return <ParentShell userName={name}>{children}</ParentShell>;
}
