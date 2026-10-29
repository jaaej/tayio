import { StudentShell } from "@/components/student/shell";
import { accountFirstName } from "@/lib/account-name";
import { requireRole } from "@/lib/auth";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("student");
  const name = accountFirstName(user, "Student");
  return <StudentShell userName={name}>{children}</StudentShell>;
}
