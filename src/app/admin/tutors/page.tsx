import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

/**
 * Tutors live in the user directory: each tutor's profile holds their
 * classes, availability and (owner only) payroll details. This route is kept
 * so older links land there.
 */
export default async function AdminTutorsPage() {
  await requireRole("admin");
  redirect("/admin/users?role=tutor");
}
