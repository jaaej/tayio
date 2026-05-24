import { PortalShell } from "@/components/portal/shell";
import { requireRole } from "@/lib/auth";

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("tutor");
  const name =
    (user.user_metadata?.first_name as string) ??
    user.email?.split("@")[0] ??
    "Tutor";
  return (
    <PortalShell role="tutor" userName={name}>
      {children}
    </PortalShell>
  );
}
