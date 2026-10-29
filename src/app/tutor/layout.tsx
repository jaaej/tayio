import { TutorShell } from "@/components/tutor/shell";
import { accountFirstName } from "@/lib/account-name";
import { requireRole } from "@/lib/auth";

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("tutor");
  const name = accountFirstName(user, "Tutor");
  return <TutorShell userName={name}>{children}</TutorShell>;
}
