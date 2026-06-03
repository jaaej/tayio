import { StudentShell } from "@/components/student/shell";
import { requireRole } from "@/lib/auth";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("student");
  const name =
    (user.user_metadata?.first_name as string) ??
    user.email?.split("@")[0] ??
    "Student";
  return <StudentShell userName={name}>{children}</StudentShell>;
}
