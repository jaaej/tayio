import { redirect } from "next/navigation";

// Subjects and their curriculum are run from Classes (its Subjects panel opens
// each subject's curriculum). Old links to the separate index land there.
export default function AdminSubjectsPage() {
  redirect("/admin/classes");
}
