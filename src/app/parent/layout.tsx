import "./theme.css";
import { ParentShell } from "@/components/parent/shell";
import { requireRole } from "@/lib/auth";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("parent");
  const name =
    (user.user_metadata?.first_name as string) ??
    user.email?.split("@")[0] ??
    "Parent";
  return <ParentShell userName={name}>{children}</ParentShell>;
}
